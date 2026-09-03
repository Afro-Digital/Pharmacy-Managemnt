const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/productController');

router.use(authenticate);

// Specific sub-paths before parameterized paths
router.get('/search', ctrl.searchProducts);
router.get('/import-template', ctrl.getImportTemplate);
router.post('/bulk-upload', requireRole(['ADMIN', 'PHARMACIST']), ctrl.bulkUploadProducts);
router.get('/low-stock', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getLowStock);
router.get('/expiring', requireRole(['ADMIN', 'PHARMACIST']), ctrl.getExpiring);

router.get('/', ctrl.getProducts);
router.post('/', requireRole(['ADMIN', 'PHARMACIST']), ctrl.createProduct);
router.get('/:id', ctrl.getProduct);
router.put('/:id', requireRole(['ADMIN', 'PHARMACIST']), ctrl.updateProduct);
router.delete('/:id', requireRole(['ADMIN']), ctrl.deleteProduct);

module.exports = router;
