const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { PAGINATION } = require('../config/constants');

// GET /api/v1/users
const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;
    const { search, role, is_active } = req.query;

    const where = {};
    if (role) where.role = role;
    if (is_active !== undefined) where.is_active = is_active === 'true';
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true, full_name: true, username: true, email: true,
          role: true, phone: true, is_active: true, created_at: true, updated_at: true,
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/users
const createUser = async (req, res, next) => {
  try {
    const { full_name, username, email, password, role, phone } = req.body;

    if (!full_name || !username || !password || !role) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Full name, username, password, and role are required' },
      });
    }

    const validRoles = ['ADMIN', 'PHARMACIST', 'CASHIER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
      });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { full_name, username, email, password_hash, role, phone },
      select: {
        id: true, full_name: true, username: true, email: true,
        role: true, phone: true, is_active: true, created_at: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'CREATE', entity_type: 'USER',
        entity_id: user.id, details: { username: user.username, role: user.role },
      },
    });

    res.status(201).json({ success: true, data: user, message: 'User created successfully' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/users/:id
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, phone, is_active, password } = req.body;

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (password) updateData.password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, full_name: true, username: true, email: true,
        role: true, phone: true, is_active: true, updated_at: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'UPDATE', entity_type: 'USER',
        entity_id: user.id, details: { updated_fields: Object.keys(updateData) },
      },
    });

    res.json({ success: true, data: user, message: 'User updated successfully' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/users/:id (soft delete — deactivate)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: { code: 'SELF_DELETE', message: 'You cannot deactivate your own account' },
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { is_active: false },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'DEACTIVATE', entity_type: 'USER',
        entity_id: user.id, details: { username: user.username },
      },
    });

    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
