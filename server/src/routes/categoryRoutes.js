const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/categoryController');

router.use(authenticate);

router.get('/', ctrl.getCategories);
router.post('/', requireRole(['ADMIN', 'PHARMACIST']), ctrl.createCategory);
router.put('/:id', requireRole(['ADMIN', 'PHARMACIST']), ctrl.updateCategory);
router.delete('/:id', requireRole(['ADMIN', 'PHARMACIST']), ctrl.deleteCategory);

module.exports = router;
