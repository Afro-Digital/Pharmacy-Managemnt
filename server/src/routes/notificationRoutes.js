const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.use(authenticate);

router.get('/', ctrl.getNotifications);

module.exports = router;
