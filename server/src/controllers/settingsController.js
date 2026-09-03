const prisma = require('../config/database');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|svg|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype.split('/')[1]);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Only image files (JPEG, PNG, SVG, WebP) are allowed'));
  },
});

// GET /api/v1/settings
const getSettings = async (req, res, next) => {
  try {
    let settings = await prisma.storeSettings.findFirst();

    if (!settings) {
      settings = await prisma.storeSettings.create({ data: {} });
    }

    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/settings
const updateSettings = async (req, res, next) => {
  try {
    let settings = await prisma.storeSettings.findFirst();

    if (!settings) {
      settings = await prisma.storeSettings.create({ data: req.body });
    } else {
      settings = await prisma.storeSettings.update({
        where: { id: settings.id },
        data: req.body,
      });
    }

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'UPDATE', entity_type: 'SETTINGS',
        entity_id: settings.id, details: { updated_fields: Object.keys(req.body) },
      },
    });

    res.json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/settings/logo
const uploadLogo = [
  upload.single('logo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION', message: 'Logo file is required' },
        });
      }

      const logoUrl = `/uploads/${req.file.filename}`;

      let settings = await prisma.storeSettings.findFirst();
      if (!settings) {
        settings = await prisma.storeSettings.create({ data: { logo_url: logoUrl } });
      } else {
        settings = await prisma.storeSettings.update({
          where: { id: settings.id },
          data: { logo_url: logoUrl },
        });
      }

      res.json({ success: true, data: { logo_url: logoUrl }, message: 'Logo uploaded successfully' });
    } catch (err) {
      next(err);
    }
  },
];

module.exports = { getSettings, updateSettings, uploadLogo };
