/**
 * Assets Service — business logic, state machine checks.
 */
const assetsRepo = require('./assets.repository');
const { ASSET_TRANSITIONS, validateTransition } = require('../../shared/stateMachines');
const { logActivity } = require('../../shared/activityLogger');
const { NotFoundError, ConflictError, ForbiddenError } = require('../../utils/errors');
const { ROLES } = require('../../shared/roles');

/**
 * Create a new asset (Asset Manager only — enforced at route level).
 */
async function createAsset(data, user) {
  // Server-generate asset_tag — never accept from client
  const assetTag = await assetsRepo.getNextAssetTag();

  const asset = await assetsRepo.create({
    ...data,
    asset_tag: assetTag,
    created_by: user.id,
  });

  await logActivity({
    userId: user.id,
    action: 'asset.registered',
    entityType: 'asset',
    entityId: asset.id,
    metadata: { asset_tag: asset.asset_tag },
  });

  return asset;
}

/**
 * Get asset by ID.
 */
async function getAssetById(id) {
  const asset = await assetsRepo.findById(id);
  if (!asset) throw new NotFoundError('Asset not found');
  return asset;
}

/**
 * List assets with filters and pagination.
 */
async function listAssets(filters, limit, offset) {
  return assetsRepo.findAll(filters, limit, offset);
}

/**
 * Update an asset.
 * If status change is included, validate through state machine.
 * Permissions: Asset Manager can edit. Admin can view only. Others cannot.
 */
async function updateAsset(id, data, user) {
  const asset = await assetsRepo.findByIdRaw(id);
  if (!asset) throw new NotFoundError('Asset not found');

  // If status is being changed, validate via state machine
  if (data.status && data.status !== asset.status) {
    validateTransition(ASSET_TRANSITIONS, asset.status, data.status);
  }

  const updated = await assetsRepo.updateById(id, data);

  await logActivity({
    userId: user.id,
    action: 'asset.updated',
    entityType: 'asset',
    entityId: id,
    metadata: { changes: Object.keys(data) },
  });

  return updated;
}

/**
 * Get merged allocation + maintenance history for an asset.
 */
async function getAssetHistory(assetId) {
  const asset = await assetsRepo.findByIdRaw(assetId);
  if (!asset) throw new NotFoundError('Asset not found');
  return assetsRepo.getHistory(assetId);
}

module.exports = {
  createAsset,
  getAssetById,
  listAssets,
  updateAsset,
  getAssetHistory,
};
