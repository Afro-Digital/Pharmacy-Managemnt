const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const prescriptionUpload = require('../middleware/prescriptionUpload');
const ctrl = require('../controllers/prescriptionController');

// WebQR Mobile Upload Session Endpoints
// Mobile phone uploads picture directly using unique sessionId without requiring staff login
router.post('/upload-session/:sessionId', prescriptionUpload.single('image'), ctrl.uploadSessionImage);
router.get('/upload-session/:sessionId', ctrl.getUploadSessionStatus);

// Authenticated Endpoints
router.use(authenticate);

// Generate QR code session for pharmacist desktop
router.post('/upload-session', requireRole(['ADMIN', 'PHARMACIST']), ctrl.createUploadSession);

router.get('/', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.getPrescriptions);
router.post('/', requireRole(['ADMIN', 'PHARMACIST']), ctrl.createPrescription);
router.get('/:id', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.getPrescription);
router.put('/:id', requireRole(['ADMIN', 'PHARMACIST']), ctrl.updatePrescription);
router.patch('/:id/status', requireRole(['ADMIN', 'PHARMACIST']), ctrl.updateStatus);
router.post('/:id/dispense', requireRole(['ADMIN', 'PHARMACIST']), ctrl.dispensePrescription);

module.exports = router;
