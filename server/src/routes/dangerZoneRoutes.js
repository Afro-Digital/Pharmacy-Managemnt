const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/dangerZoneController');

// All danger zone routes require authentication and strictly ADMIN role
router.use(authenticate);
router.use(requireRole(['ADMIN']));

router.get('/stats', ctrl.getStats);
router.post('/delete-all-products', ctrl.deleteAllProducts);
router.post('/clear-all-sales', ctrl.clearAllSales);
router.post('/reset-inventory', ctrl.resetInventoryQuantities);
router.post('/clear-prescriptions', ctrl.clearAllPrescriptions);
router.post('/factory-reset', ctrl.factoryReset);

module.exports = router;
