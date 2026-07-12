/**
 * Allocation & Transfer Routes
 *
 * POST   /api/v1/allocations                        — create
 * POST   /api/v1/allocations/:id/return              — return
 * GET    /api/v1/allocations                         — list (?overdue=true)
 * POST   /api/v1/transfer-requests                   — create transfer
 * PATCH  /api/v1/transfer-requests/:id/approve       — approve
 * PATCH  /api/v1/transfer-requests/:id/reject        — reject
 */
const express = require('express');
const router = express.Router();
const allocController = require('./allocation.controller');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');
const validateRequest = require('../../middlewares/validateRequest');
const {
  createAllocationSchema,
  returnAllocationSchema,
  createTransferRequestSchema,
  transferActionSchema,
} = require('./allocation.validators');
const { ROLES } = require('../../shared/roles');

router.use(authenticate);

router.get('/', allocController.getAllocations);

router.post(
  '/',
  authorize(ROLES.ASSET_MANAGER, ROLES.DEPARTMENT_HEAD),
  validateRequest(createAllocationSchema),
  allocController.createAllocation
);

router.post(
  '/:id/return',
  authorize(ROLES.ASSET_MANAGER, ROLES.DEPARTMENT_HEAD),
  validateRequest(returnAllocationSchema),
  allocController.returnAllocation
);

// Direct transfer — admin / asset_manager only (no request/approval needed)
router.post(
  '/direct-transfer',
  authorize(ROLES.ADMIN, ROLES.ASSET_MANAGER),
  allocController.directTransfer
);

module.exports = router;
