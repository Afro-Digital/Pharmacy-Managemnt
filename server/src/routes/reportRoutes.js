const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/reportController');

router.use(authenticate);

router.get('/dashboard', ctrl.getDashboard);
router.get('/sales', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getSalesReport);
router.get('/inventory', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getInventoryReport);
router.get('/financial', requireRole(['ADMIN']), ctrl.getFinancialReport);
router.get('/prescriptions', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getPrescriptionReport);
router.get('/expiring-products', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getExpiringReport);
router.get('/stock-movement', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getStockMovement);
router.get('/export', requireRole(['ADMIN']), ctrl.exportReport);

module.exports = router;
