/**
 * Audit Service — business logic, state machine, transactions.
 *
 * §5.4 Audit cycle: planned -> in_progress -> closed
 * §6 Close: atomic flip, discrepancy generation, missing → lost
 */
const { pool } = require('../../config/db');
const auditRepo = require('./audit.repository');
const assetsRepo = require('../assets/assets.repository');
const { AUDIT_CYCLE_TRANSITIONS, ASSET_TRANSITIONS, validateTransition } = require('../../shared/stateMachines');
const { logActivity } = require('../../shared/activityLogger');
const { NotFoundError, ConflictError, ForbiddenError } = require('../../utils/errors');

async function createCycle(data, user) {
  const cycle = await auditRepo.createCycle({ ...data, created_by: user.id });

  await logActivity({
    userId: user.id, action: 'audit_cycle.created',
    entityType: 'audit_cycle', entityId: cycle.id,
  });

  return cycle;
}

async function addAuditors(cycleId, auditorIds, assetIds, user) {
  const cycle = await auditRepo.findCycleById(cycleId);
  if (!cycle) throw new NotFoundError('Audit cycle not found');
  if (cycle.status === 'closed') throw new ConflictError('Cannot modify a closed audit cycle');

  // If cycle is planned, transition to in_progress
  if (cycle.status === 'planned') {
    validateTransition(AUDIT_CYCLE_TRANSITIONS, cycle.status, 'in_progress');
    await auditRepo.updateCycleStatus(cycleId, 'in_progress');
  }

  const auditors = await auditRepo.addAuditors(cycleId, auditorIds);

  // Optionally create audit items for specified assets
  let items = [];
  if (assetIds && assetIds.length > 0) {
    items = await auditRepo.createItems(cycleId, assetIds);
  }

  await logActivity({
    userId: user.id, action: 'audit_cycle.auditors_added',
    entityType: 'audit_cycle', entityId: cycleId,
    metadata: { auditor_count: auditorIds.length, item_count: items.length },
  });

  return { auditors, items };
}

async function getItems(cycleId, limit, offset) {
  const cycle = await auditRepo.findCycleById(cycleId);
  if (!cycle) throw new NotFoundError('Audit cycle not found');
  return auditRepo.findItemsByCycleId(cycleId, limit, offset);
}

async function updateItem(itemId, data, user) {
  const item = await auditRepo.findItemById(itemId);
  if (!item) throw new NotFoundError('Audit item not found');

  // §5.4: Closed audit → immutable
  if (item.cycle_status === 'closed') {
    const err = new ConflictError('Cannot update items in a closed audit cycle');
    err.code = 'AUDIT_CYCLE_CLOSED';
    throw err;
  }

  // Check user is an assigned auditor
  const authorized = await auditRepo.isAuditor(item.audit_cycle_id, user.id);
  if (!authorized) {
    throw new ForbiddenError('You are not assigned as an auditor for this cycle');
  }

  const updated = await auditRepo.updateItemResult(itemId, data.result, user.id, data.notes);

  await logActivity({
    userId: user.id, action: 'audit_item.marked',
    entityType: 'audit_item', entityId: itemId,
    metadata: { result: data.result, asset_id: item.asset_id },
  });

  return updated;
}

async function closeCycle(cycleId, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // §5.4: Atomic close — only if not already closed
    const closed = await auditRepo.atomicClose(cycleId, client);
    if (!closed) {
      await client.query('ROLLBACK');
      const err = new ConflictError('Audit cycle is already closed');
      err.code = 'AUDIT_ALREADY_CLOSED';
      throw err;
    }

    // Get discrepant items
    const discrepantItems = await auditRepo.findDiscrepantItems(cycleId, client);

    // Generate discrepancy reports and handle missing assets
    for (const item of discrepantItems) {
      await auditRepo.createDiscrepancyReport({
        audit_cycle_id: cycleId,
        asset_id: item.asset_id,
        issue_type: item.result, // 'missing' or 'damaged'
      }, client);

      // For missing items, transition asset to 'lost'
      if (item.result === 'missing') {
        try {
          validateTransition(ASSET_TRANSITIONS, item.asset_status, 'lost');
          await assetsRepo.updateStatus(item.asset_id, 'lost', client);
        } catch (e) {
          // If asset can't transition to lost (e.g. already lost/disposed), skip
          console.warn(`[audit] Could not transition asset ${item.asset_tag} to lost: ${e.message}`);
        }
      }
    }

    await client.query('COMMIT');

    await logActivity({
      userId: user.id, action: 'audit_cycle.closed',
      entityType: 'audit_cycle', entityId: cycleId,
      metadata: { discrepancy_count: discrepantItems.length },
    });

    return auditRepo.findCycleById(cycleId);
  } catch (error) {
    if (error.code !== 'AUDIT_ALREADY_CLOSED') {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getDiscrepancyReport(cycleId) {
  const cycle = await auditRepo.findCycleById(cycleId);
  if (!cycle) throw new NotFoundError('Audit cycle not found');
  const discrepancies = await auditRepo.findDiscrepanciesByCycleId(cycleId);
  return { cycle, discrepancies };
}

module.exports = {
  createCycle, addAuditors, getItems, updateItem, closeCycle, getDiscrepancyReport,
};
