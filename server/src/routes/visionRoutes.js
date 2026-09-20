const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  extractProductFromImage,
  lookupBarcode,
  createScanSession,
  getScanSessionStatus,
  uploadScanSessionImage,
} = require('../controllers/visionController');

const router = express.Router();

// Use memory storage — we process the image in-memory with sharp before sending to Gemini
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|heic/;
    const extOk = allowed.test(file.originalname.toLowerCase());
    const mimeOk = file.mimetype.startsWith('image/');
    if (extOk || mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are accepted for medicine scanning'));
    }
  },
});

// POST /api/v1/vision/extract-product — Upload a medicine photo and get structured product data
router.post(
  '/extract-product',
  authenticate,
  requireRole(['ADMIN', 'PHARMACIST']),
  upload.single('image'),
  extractProductFromImage
);

// POST /api/v1/vision/lookup-barcode — Look up a product by barcode/SKU
router.post(
  '/lookup-barcode',
  authenticate,
  requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']),
  lookupBarcode
);

// POST /api/v1/vision/scan-session — Desktop initiates a phone scan session
router.post(
  '/scan-session',
  authenticate,
  requireRole(['ADMIN', 'PHARMACIST']),
  createScanSession
);

// GET /api/v1/vision/scan-session/:sessionId — Check scan session status (desktop polling)
router.get(
  '/scan-session/:sessionId',
  getScanSessionStatus
);

// POST /api/v1/vision/scan-session/:sessionId — Phone uploads medicine photo
router.post(
  '/scan-session/:sessionId',
  upload.single('image'),
  uploadScanSessionImage
);

module.exports = router;
