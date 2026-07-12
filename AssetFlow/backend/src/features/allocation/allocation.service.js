/**
 * Allocation Service — business logic, state machine checks, transactions.
 *
 * Edge cases handled (§6):
 *  - Double allocation → 409 ASSET_ALREADY_ALLOCATED (DB partial unique index catch)
 *  - Allocate retired/lost/under_maintenance → reject before insert
 *  - Return twice → 409
 *  - Invalid return date → validate in service
 *  - Transfer to same employee → reject
 *  - Transfer unavailable asset → reject
 *  - Transfer already actioned → 409 TRANSFER_ALREADY_ACTIONED
 */
const { pool } = require('../../config/db');
const allocRepo = require('./allocation.repository');
const assetsRepo = require('../assets/assets.repository');
const { ASSET_TRANSITIONS, TRANSFER_TRANSITIONS, validateTransition } = require('../../shared/stateMachines');
const { logActivity } = require('../../shared/activityLogger');
const { notify } = require('../../shared/notifier');
const { NotFoundError, ConflictError, ValidationError, ForbiddenError } = require('../../utils/errors');
const { ROLES } = require('../../shared/roles');

/**
 * Check if an allocation is overdue.
 * Single shared function — reused everywhere (§6 overdue detection).
 */
function isOverdue(allocation) {
  return (
    allocation.status === 'active' &&
    allocation.expected_return_date &&
    new Date() > new Date(allocation.expected_return_date)
  );
}

/**
 * Check allocation permissions.
 * Asset Manager: full access
 * Dept Head: own department only
 * Employee: request only (handled at route level)
 */
function checkAllocationPermission(user, assetDepartmentId) {
  if (user.role === ROLES.ASSET_MANAGER || user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.DEPARTMENT_HEAD) {
    if (user.department_id !== assetDepartmentId) {
      throw new ForbiddenError('Department heads can only allocate assets in their own department');
    }
    return;
  }
  throw new ForbiddenError('You do not have permission to allocate assets');
}

// ───────────────────────────────────────────────────────────
// Allocations
// ───────────────────────────────────────────────────────────

/**
 * Create allocation.
 */
async function createAllocation(data, user) {
  // 1. Check asset exists and is available
  const asset = await assetsRepo.findByIdRaw(data.asset_id);
  if (!asset) throw new NotFoundError('Asset not found');

  // Only available assets can be allocated
  if (asset.status !== 'available') {
    throw new ConflictError(`Asset ${asset.asset_tag} is not available for allocation (current status: ${asset.status})`);
  }

  // 2. Permission check (dept head scoping)
  checkAllocationPermission(user, asset.department_id);

  // 3. Insert allocation + update asset status in a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Transition asset: available -> allocated
    validateTransition(ASSET_TRANSITIONS, asset.status, 'allocated');
    await assetsRepo.updateStatus(data.asset_id, 'allocated', client);

    const allocation = await allocRepo.create(
      { ...data, allocated_by: user.id },
      client
    );

    await client.query('COMMIT');

    await logActivity({
      userId: user.id,
      action: 'asset.allocated',
      entityType: 'allocation',
      entityId: allocation.id,
      metadata: { asset_id: data.asset_id, asset_tag: asset.asset_tag, employee_id: data.employee_id },
    });

    if (data.employee_id) {
      await notify({
        userId: data.employee_id,
        type: 'asset_assigned',
        message: `Asset ${asset.asset_tag} has been allocated to you`,
        relatedEntityType: 'allocation',
        relatedEntityId: allocation.id,
      });
    }

    return allocation;
  } catch (error) {
    await client.query('ROLLBACK');

    // §6: Catch Postgres unique violation from partial unique index
    if (error.code === '23505') {
      // Find who currently holds it
      const currentAlloc = await allocRepo.findActiveByAssetId(data.asset_id);
      const holderName = currentAlloc ? currentAlloc.employee_name : 'another user';
      const err = new ConflictError(
        `Asset ${asset.asset_tag} is currently held by ${holderName}.`
      );
      err.code = 'ASSET_ALREADY_ALLOCATED';
      throw err;
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Return an allocation.
 */
async function returnAllocation(allocationId, data, user) {
  const allocation = await allocRepo.findById(allocationId);
  if (!allocation) throw new NotFoundError('Allocation not found');

  // §6: Return twice check
  if (allocation.status === 'returned') {
    throw new ConflictError('This allocation has already been returned');
  }
  if (allocation.status !== 'active') {
    throw new ConflictError(`Cannot return allocation with status '${allocation.status}'`);
  }

  // §6: Invalid return date — can't be before allocated_date
  const body = data || {};
  const returnDate = body.actual_return_date ? new Date(body.actual_return_date) : new Date();
  if (returnDate < new Date(allocation.allocated_date)) {
    throw new ValidationError('Return date cannot be before allocation date');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Return allocation
    const returned = await allocRepo.returnAllocation(allocationId, {
      actual_return_date: returnDate.toISOString(),
      return_condition_notes: body.return_condition_notes,
    }, client);

    // Transition asset: allocated -> available
    validateTransition(ASSET_TRANSITIONS, 'allocated', 'available');
    await assetsRepo.updateStatus(allocation.asset_id, 'available', client);

    await client.query('COMMIT');

    await logActivity({
      userId: user.id,
      action: 'asset.returned',
      entityType: 'allocation',
      entityId: allocationId,
      metadata: { asset_id: allocation.asset_id, asset_tag: allocation.asset_tag },
    });

    if (allocation.employee_id) {
      await notify({
        userId: allocation.employee_id,
        type: 'asset_returned',
        message: `Asset ${allocation.asset_tag || ''} has been unallocated/returned from your account`,
        relatedEntityType: 'allocation',
        relatedEntityId: allocationId,
      });
    }

    return returned;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * List allocations with optional overdue filter.
 */
async function listAllocations(filters, limit, offset) {
  return allocRepo.findAll(filters, limit, offset);
}

// ───────────────────────────────────────────────────────────
// Transfer Requests
// ───────────────────────────────────────────────────────────

/**
 * Create a transfer request.
 */
async function createTransferRequest(data, user) {
  // 1. Load current allocation
  const allocation = await allocRepo.findById(data.from_allocation_id);
  if (!allocation) throw new NotFoundError('Source allocation not found');

  // §6: Transfer unavailable asset — if allocation is no longer active, reject
  if (allocation.status !== 'active') {
    throw new ConflictError('Cannot transfer from a non-active allocation');
  }

  // Verify asset_id matches the allocation
  if (allocation.asset_id !== data.asset_id) {
    throw new ValidationError('asset_id does not match the allocation');
  }

  // §6: Transfer to same employee
  if (allocation.employee_id === data.requested_to_employee_id) {
    throw new ValidationError('Cannot transfer asset to the same employee who currently holds it');
  }

  const transfer = await allocRepo.createTransferRequest({
    ...data,
    requested_by: user.id,
  });

  await logActivity({
    userId: user.id,
    action: 'transfer.requested',
    entityType: 'transfer_request',
    entityId: transfer.id,
    metadata: { asset_id: data.asset_id, to_employee_id: data.requested_to_employee_id },
  });

  return transfer;
}

/**
 * Approve a transfer request.
 */
async function approveTransfer(transferId, user) {
  const transfer = await allocRepo.findTransferById(transferId);
  if (!transfer) throw new NotFoundError('Transfer request not found');

  // §6 / §5.3: Only allow approve if status is 'requested'
  if (transfer.status !== 'requested') {
    const err = new ConflictError('Transfer has already been actioned');
    err.code = 'TRANSFER_ALREADY_ACTIONED';
    throw err;
  }

  // Permission check: Asset Manager or Dept Head (own dept)
  if (user.role === ROLES.DEPARTMENT_HEAD && user.department_id !== transfer.asset_department_id) {
    throw new ForbiddenError('Department heads can only approve transfers in their own department');
  }

  // Approve the transfer (status -> approved, then immediately complete)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Approve
    validateTransition(TRANSFER_TRANSITIONS, transfer.status, 'approved');
    await allocRepo.updateTransferStatus(transferId, 'approved', user.id, client);

    // Complete: close old allocation, create new one
    validateTransition(TRANSFER_TRANSITIONS, 'approved', 'completed');

    // Return old allocation
    await allocRepo.returnAllocation(transfer.from_allocation_id, {
      actual_return_date: new Date().toISOString(),
      return_condition_notes: 'Returned via transfer',
    }, client);

    // Create new allocation for the target employee
    const newAllocation = await allocRepo.create({
      asset_id: transfer.asset_id,
      employee_id: transfer.requested_to_employee_id,
      department_id: transfer.asset_department_id,
      allocated_by: user.id,
    }, client);

    // Mark transfer completed
    await allocRepo.updateTransferStatus(transferId, 'completed', user.id, client);

    await client.query('COMMIT');

    await logActivity({
      userId: user.id,
      action: 'transfer.completed',
      entityType: 'transfer_request',
      entityId: transferId,
      metadata: {
        asset_id: transfer.asset_id,
        new_allocation_id: newAllocation.id,
        new_employee_id: transfer.requested_to_employee_id,
      },
    });

    await notify({
      userId: transfer.requested_to_employee_id,
      type: 'transfer_approved',
      message: `Transfer of asset ${transfer.asset_tag} to you has been approved`,
      relatedEntityType: 'transfer_request',
      relatedEntityId: transferId,
    });

    if (transfer.requested_from_employee_id) {
      await notify({
        userId: transfer.requested_from_employee_id,
        type: 'asset_transferred',
        message: `Transfer of asset ${transfer.asset_tag} from your account has been approved and completed`,
        relatedEntityType: 'transfer_request',
        relatedEntityId: transferId,
      });
    }

    return { transfer: await allocRepo.findTransferById(transferId), newAllocation };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reject a transfer request.
 */
async function rejectTransfer(transferId, user) {
  const transfer = await allocRepo.findTransferById(transferId);
  if (!transfer) throw new NotFoundError('Transfer request not found');

  // §6: Only allow reject if status is 'requested'
  if (transfer.status !== 'requested') {
    const err = new ConflictError('Transfer has already been actioned');
    err.code = 'TRANSFER_ALREADY_ACTIONED';
    throw err;
  }

  // Permission check
  if (user.role === ROLES.DEPARTMENT_HEAD && user.department_id !== transfer.asset_department_id) {
    throw new ForbiddenError('Department heads can only reject transfers in their own department');
  }

  validateTransition(TRANSFER_TRANSITIONS, transfer.status, 'rejected');
  const updated = await allocRepo.updateTransferStatus(transferId, 'rejected', user.id);

  await logActivity({
    userId: user.id,
    action: 'transfer.rejected',
    entityType: 'transfer_request',
    entityId: transferId,
    metadata: { asset_id: transfer.asset_id },
  });

  return updated;
}

/**
 * Direct transfer — admin / asset_manager only.
 * Atomically returns old allocation and creates a new one for the target employee.
 * No transfer-request / approval flow needed.
 */
async function directTransfer(data, user) {
  // Only admin or asset_manager may direct-transfer
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.ASSET_MANAGER) {
    throw new ForbiddenError('Only admin or asset manager can perform a direct transfer');
  }

  const asset = await assetsRepo.findByIdRaw(data.asset_id);
  if (!asset) throw new NotFoundError('Asset not found');

  // Find active allocation for this asset
  const currentAlloc = await allocRepo.findActiveByAssetId(data.asset_id);
  if (!currentAlloc) {
    throw new ConflictError('No active allocation found for this asset. Use "Allocate" instead.');
  }

  // Can't transfer to the same person
  if (currentAlloc.employee_id === data.to_employee_id) {
    throw new ValidationError('Cannot transfer asset to the same employee who currently holds it');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Return old allocation
    await allocRepo.returnAllocation(currentAlloc.id, {
      actual_return_date: new Date().toISOString(),
      return_condition_notes: data.reason || 'Direct transfer by admin/manager',
    }, client);

    // Create new allocation for target employee
    const newAllocation = await allocRepo.create({
      asset_id: data.asset_id,
      employee_id: data.to_employee_id,
      department_id: data.department_id || asset.department_id,
      allocated_by: user.id,
    }, client);

    await client.query('COMMIT');

    await logActivity({
      userId: user.id,
      action: 'asset.direct_transfer',
      entityType: 'allocation',
      entityId: newAllocation.id,
      metadata: {
        asset_id: data.asset_id,
        asset_tag: asset.asset_tag,
        from_employee_id: currentAlloc.employee_id,
        to_employee_id: data.to_employee_id,
      },
    });

    if (currentAlloc.employee_id) {
      await notify({
        userId: currentAlloc.employee_id,
        type: 'asset_transferred',
        message: `Asset ${asset.asset_tag} has been transferred from your account`,
        relatedEntityType: 'allocation',
        relatedEntityId: currentAlloc.id,
      });
    }

    if (data.to_employee_id) {
      await notify({
        userId: data.to_employee_id,
        type: 'asset_assigned',
        message: `Asset ${asset.asset_tag} has been transferred to you`,
        relatedEntityType: 'allocation',
        relatedEntityId: newAllocation.id,
      });
    }

    return { previousAllocation: currentAlloc, newAllocation };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  isOverdue,
  createAllocation,
  returnAllocation,
  listAllocations,
  createTransferRequest,
  approveTransfer,
  rejectTransfer,
  directTransfer,
};
