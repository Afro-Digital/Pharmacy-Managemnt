const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/prescriptionController');

router.use(authenticate);

router.get('/', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.getPrescriptions);
router.post('/', requireRole(['ADMIN', 'PHARMACIST']), ctrl.createPrescription);
router.get('/:id', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.getPrescription);
router.put('/:id', requireRole(['ADMIN', 'PHARMACIST']), ctrl.updatePrescription);
router.patch('/:id/status', requireRole(['ADMIN', 'PHARMACIST']), ctrl.updateStatus);
router.post('/:id/dispense', requireRole(['ADMIN', 'PHARMACIST']), ctrl.dispensePrescription);

module.exports = router;
