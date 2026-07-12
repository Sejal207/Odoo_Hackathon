/**
 * Maintenance Routes
 *
 * POST   /api/v1/maintenance-requests                        — raise
 * PATCH  /api/v1/maintenance-requests/:id/approve             — approve
 * PATCH  /api/v1/maintenance-requests/:id/reject              — reject
 * PATCH  /api/v1/maintenance-requests/:id/assign-technician   — assign
 * PATCH  /api/v1/maintenance-requests/:id/start               — start work
 * PATCH  /api/v1/maintenance-requests/:id/resolve             — resolve
 * GET    /api/v1/assets/:id/maintenance-history               — history (mounted separately)
 */
const express = require('express');
const router = express.Router();
const ctrl = require('./maintenance.controller');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');
const validateRequest = require('../../middlewares/validateRequest');
const {
  createMaintenanceSchema, maintenanceActionSchema,
  assignTechnicianSchema, resolveSchema,
} = require('./maintenance.validators');
const { ROLES } = require('../../shared/roles');

router.use(authenticate);

// Any authenticated user can raise a maintenance request
router.post('/', validateRequest(createMaintenanceSchema), ctrl.createRequest);

// Approve/reject — Asset Manager only
router.patch('/:id/approve',
  authorize(ROLES.ASSET_MANAGER),
  validateRequest(maintenanceActionSchema),
  ctrl.approveRequest
);
router.patch('/:id/reject',
  authorize(ROLES.ASSET_MANAGER),
  validateRequest(maintenanceActionSchema),
  ctrl.rejectRequest
);

// Assign technician — Asset Manager
router.patch('/:id/assign-technician',
  authorize(ROLES.ASSET_MANAGER),
  validateRequest(assignTechnicianSchema),
  ctrl.assignTechnician
);

// Start / resolve — Asset Manager
router.patch('/:id/start',
  authorize(ROLES.ASSET_MANAGER),
  validateRequest(maintenanceActionSchema),
  ctrl.startWork
);
router.patch('/:id/resolve',
  authorize(ROLES.ASSET_MANAGER),
  validateRequest(resolveSchema),
  ctrl.resolveRequest
);

module.exports = router;
