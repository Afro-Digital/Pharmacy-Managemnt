const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/settingsController');

// GET settings can be fetched without auth (for theme/branding on login page) or with auth
router.get('/', ctrl.getSettings);

router.put('/', authenticate, requireRole(['ADMIN']), ctrl.updateSettings);
router.post('/logo', authenticate, requireRole(['ADMIN']), ctrl.uploadLogo);

module.exports = router;
