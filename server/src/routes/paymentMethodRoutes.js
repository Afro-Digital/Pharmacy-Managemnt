const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/paymentMethodController');

router.use(authenticate);

router.get('/', ctrl.getPaymentMethods);
router.post('/', requireRole(['ADMIN']), ctrl.createPaymentMethod);
router.put('/:id', requireRole(['ADMIN']), ctrl.updatePaymentMethod);
router.delete('/:id', requireRole(['ADMIN']), ctrl.deletePaymentMethod);

module.exports = router;
