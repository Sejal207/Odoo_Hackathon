/**
 * Assets Routes
 *
 * GET    /api/v1/assets              — list (filtered, paginated)
 * POST   /api/v1/assets              — create (Asset Manager only)
 * GET    /api/v1/assets/:id          — get by id
 * PATCH  /api/v1/assets/:id          — update
 * GET    /api/v1/assets/:id/history  — merged allocation + maintenance history
 */
const express = require('express');
const router = express.Router();

const assetsController = require('./assets.controller');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');
const validateRequest = require('../../middlewares/validateRequest');
const { createAssetSchema, updateAssetSchema, getAssetByIdSchema } = require('./assets.validators');
const { ROLES } = require('../../shared/roles');

// All asset routes require authentication
router.use(authenticate);

// List assets — all authenticated users
router.get('/', assetsController.getAssets);

// Metadata for asset filters and register form
router.get('/meta', assetsController.getMetadata);

// Create asset — Asset Manager only
router.post(
  '/',
  authorize(ROLES.ASSET_MANAGER),
  validateRequest(createAssetSchema),
  assetsController.createAsset
);

// Get asset by ID — all authenticated users
router.get('/:id', validateRequest(getAssetByIdSchema), assetsController.getAssetById);

// Update asset — Asset Manager only
router.patch(
  '/:id',
  authorize(ROLES.ASSET_MANAGER),
  validateRequest(updateAssetSchema),
  assetsController.updateAsset
);

// Get asset history — all authenticated users
router.get('/:id/history', validateRequest(getAssetByIdSchema), assetsController.getAssetHistory);

module.exports = router;
