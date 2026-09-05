const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const ctrl = require('../controllers/shiftController');

router.use(authenticate);

router.get('/current', ctrl.getCurrentShift);
router.post('/start', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.startShift);
router.post('/end', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.endShift);
router.get('/summary', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.getShiftSummary);
router.get('/', requireRole(['ADMIN', 'PHARMACIST', 'CASHIER']), ctrl.getShifts);

module.exports = router;
