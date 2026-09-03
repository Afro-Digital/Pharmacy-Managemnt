const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/saleController');

router.use(authenticate);

router.get('/', ctrl.getSales);
router.post('/', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.createSale);
router.get('/:id', ctrl.getSale);
router.get('/:id/receipt', ctrl.getReceipt);
router.post('/:id/pay', requireRole(['ADMIN', 'CASHIER']), ctrl.confirmPayment);
router.post('/:id/cancel', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.cancelPendingSale);
router.post('/:id/refund', requireRole(['ADMIN']), ctrl.refundSale);

module.exports = router;
