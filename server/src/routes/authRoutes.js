const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

router.get('/setup-status', ctrl.getSetupStatus);
router.post('/setup', ctrl.initialSetup);
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
