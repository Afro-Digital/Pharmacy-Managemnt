const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/reconciliationController');

router.use(authenticate);

router.get('/preview', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.getReconciliationPreview);
router.get('/export', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.exportReconciliation);
router.get('/', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.getReconciliations);
router.get('/:id', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.getReconciliation);
router.post('/', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.createReconciliation);
router.post('/:id/approve', requireRole(['ADMIN']), ctrl.approveReconciliation);

module.exports = router;
