/**
 * Maintenance Service — business logic, state machine, transactions.
 *
 * Edge cases (§6):
 *  - Multiple active maintenance for same asset → blocked
 *  - Approve/reject twice → 409
 *  - Resolve before approval → blocked by state machine
 *  - On approved: asset → under_maintenance (in txn)
 *  - On resolved: asset → available (in txn)
 */
const { pool } = require('../../config/db');
const maintRepo = require('./maintenance.repository');
const assetsRepo = require('../assets/assets.repository');
const { MAINTENANCE_TRANSITIONS, ASSET_TRANSITIONS, validateTransition } = require('../../shared/stateMachines');
const { logActivity } = require('../../shared/activityLogger');
const { notify } = require('../../shared/notifier');
const { NotFoundError, ConflictError } = require('../../utils/errors');

async function createRequest(data, user) {
  const asset = await assetsRepo.findByIdRaw(data.asset_id);
  if (!asset) throw new NotFoundError('Asset not found');

  // Block if unresolved request already exists for this asset
  const existing = await maintRepo.findActiveByAssetId(data.asset_id);
  if (existing) {
    throw new ConflictError('An unresolved maintenance request already exists for this asset');
  }

  const request = await maintRepo.create({ ...data, raised_by: user.id });

  await logActivity({
    userId: user.id, action: 'maintenance.raised',
    entityType: 'maintenance_request', entityId: request.id,
    metadata: { asset_id: data.asset_id },
  });

  return request;
}

async function approveRequest(id, user) {
  const req = await maintRepo.findById(id);
  if (!req) throw new NotFoundError('Maintenance request not found');

  validateTransition(MAINTENANCE_TRANSITIONS, req.status, 'approved');

  // Check asset can transition to under_maintenance
  if (['retired', 'disposed'].includes(req.asset_status)) {
    const err = new ConflictError(`Asset is not available for maintenance (status: ${req.asset_status})`);
    err.code = 'ASSET_NOT_AVAILABLE_FOR_MAINTENANCE';
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await maintRepo.updateStatus(id, 'approved', { approved_by: user.id }, client);
    if (req.asset_status !== 'under_maintenance') {
      validateTransition(ASSET_TRANSITIONS, req.asset_status, 'under_maintenance');
      await assetsRepo.updateStatus(req.asset_id, 'under_maintenance', client);
    }

    await client.query('COMMIT');

    await logActivity({
      userId: user.id, action: 'maintenance.approved',
      entityType: 'maintenance_request', entityId: id,
      metadata: { asset_id: req.asset_id },
    });

    return maintRepo.findById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function rejectRequest(id, user) {
  const req = await maintRepo.findById(id);
  if (!req) throw new NotFoundError('Maintenance request not found');

  validateTransition(MAINTENANCE_TRANSITIONS, req.status, 'rejected');

  const updated = await maintRepo.updateStatus(id, 'rejected', { approved_by: user.id });

  await logActivity({
    userId: user.id, action: 'maintenance.rejected',
    entityType: 'maintenance_request', entityId: id,
    metadata: { asset_id: req.asset_id },
  });

  return updated;
}

async function assignTechnician(id, technicianName, user) {
  const req = await maintRepo.findById(id);
  if (!req) throw new NotFoundError('Maintenance request not found');

  validateTransition(MAINTENANCE_TRANSITIONS, req.status, 'technician_assigned');

  const updated = await maintRepo.updateStatus(id, 'technician_assigned', {
    technician_name: technicianName,
  });

  await logActivity({
    userId: user.id, action: 'maintenance.technician_assigned',
    entityType: 'maintenance_request', entityId: id,
    metadata: { technician_name: technicianName },
  });

  return updated;
}

async function startWork(id, user) {
  const req = await maintRepo.findById(id);
  if (!req) throw new NotFoundError('Maintenance request not found');

  validateTransition(MAINTENANCE_TRANSITIONS, req.status, 'in_progress');

  const updated = await maintRepo.updateStatus(id, 'in_progress');

  await logActivity({
    userId: user.id, action: 'maintenance.started',
    entityType: 'maintenance_request', entityId: id,
    metadata: { asset_id: req.asset_id },
  });

  return updated;
}

async function resolveRequest(id, data, user) {
  const req = await maintRepo.findById(id);
  if (!req) throw new NotFoundError('Maintenance request not found');

  validateTransition(MAINTENANCE_TRANSITIONS, req.status, 'resolved');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await maintRepo.updateStatus(id, 'resolved', {
      resolved_at: new Date().toISOString(),
      resolution_notes: data.resolution_notes || null,
    }, client);

    // Asset: under_maintenance -> available
    validateTransition(ASSET_TRANSITIONS, 'under_maintenance', 'available');
    await assetsRepo.updateStatus(req.asset_id, 'available', client);

    await client.query('COMMIT');

    await logActivity({
      userId: user.id, action: 'maintenance.resolved',
      entityType: 'maintenance_request', entityId: id,
      metadata: { asset_id: req.asset_id },
    });

    return maintRepo.findById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getMaintenanceHistory(assetId, limit, offset) {
  const asset = await assetsRepo.findByIdRaw(assetId);
  if (!asset) throw new NotFoundError('Asset not found');
  return maintRepo.findByAssetId(assetId, limit, offset);
}

async function listRequests(status) {
  const [items, counts] = await Promise.all([
    maintRepo.findAll(status),
    maintRepo.getCountsByStatus(),
  ]);
  return { items, counts };
}

module.exports = {
  createRequest, approveRequest, rejectRequest,
  assignTechnician, startWork, resolveRequest,
  getMaintenanceHistory, listRequests,
};
