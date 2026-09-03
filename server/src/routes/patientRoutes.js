const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/patientController');

router.use(authenticate);

router.get('/', ctrl.getPatients);
router.post('/', requireRole(['ADMIN', 'PHARMACIST']), ctrl.createPatient);
router.get('/:id', ctrl.getPatient);
router.put('/:id', requireRole(['ADMIN', 'PHARMACIST']), ctrl.updatePatient);
router.get('/:id/prescriptions', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getPatientPrescriptions);
router.get('/:id/purchases', ctrl.getPatientPurchases);

module.exports = router;
