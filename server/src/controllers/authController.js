const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

// Generate JWT tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// POST /api/v1/auth/login
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Username and password are required' },
      });
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'LOGIN',
        entity_type: 'USER',
        entity_id: user.id,
        ip_address: req.ip,
      },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          full_name: user.full_name,
          username: user.username,
          email: user.email,
          role: user.role,
          phone: user.phone,
        },
        accessToken,
        refreshToken,
      },
      message: 'Login successful',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Refresh token is required' },
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' },
      });
    }

    const tokens = generateTokens(user);

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      message: 'Token refreshed successfully',
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }
    next(err);
  }
};

// POST /api/v1/auth/logout
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await prisma.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'LOGOUT',
          entity_type: 'USER',
          entity_id: req.user.id,
          ip_address: req.ip,
        },
      });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        full_name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        is_active: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/auth/setup-status
const getSetupStatus = async (req, res, next) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      success: true,
      data: { isSetup: userCount > 0 },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/setup
const initialSetup = async (req, res, next) => {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_SETUP', message: 'System is already set up' },
      });
    }

    const { full_name, username, email, password, phone } = req.body;

    if (!full_name || !username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Full name, username, and password are required' },
      });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        full_name,
        username,
        email,
        password_hash,
        role: 'ADMIN',
        phone,
      },
    });

    // Create default store settings if not exist
    const settingsCount = await prisma.storeSettings.count();
    if (settingsCount === 0) {
      await prisma.storeSettings.create({ data: {} });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          full_name: user.full_name,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
      message: 'Initial admin account created successfully',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, refresh, logout, getMe, getSetupStatus, initialSetup };
