/**
 * Maintenance History Route — mounted at /api/v1/assets/:id/maintenance-history
 * Kept as a separate router to avoid modifying the assets routes file.
 */
const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :id from parent
const ctrl = require('./maintenance.controller');
const authenticate = require('../../middlewares/auth.middleware');

router.use(authenticate);
router.get('/', ctrl.getMaintenanceHistory);

module.exports = router;
