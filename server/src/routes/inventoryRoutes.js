const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/inventoryController');

router.use(authenticate);

router.get('/store', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getStoreInventory);
router.get('/dispensary', ctrl.getDispensaryInventory);
router.get('/transfers', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getTransfers);
router.post('/transfer', requireRole(['ADMIN', 'PHARMACIST']), ctrl.transferStock);

router.get('/', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getInventory);
router.post('/', requireRole(['ADMIN', 'PHARMACIST']), ctrl.addStock);
router.put('/:id', requireRole(['ADMIN', 'PHARMACIST']), ctrl.adjustStock);

module.exports = router;
