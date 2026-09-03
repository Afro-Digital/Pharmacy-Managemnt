const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/userController');

router.use(authenticate, requireRole(['ADMIN']));

router.get('/', ctrl.getUsers);
router.post('/', ctrl.createUser);
router.put('/:id', ctrl.updateUser);
router.delete('/:id', ctrl.deleteUser);

module.exports = router;
