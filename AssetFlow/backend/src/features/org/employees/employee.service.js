// ============================================================
// employee.service.js
// All business logic for Employee Directory & Role Management.
// ============================================================

const { pool } = require('../../../config/db');
const {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} = require('../../../utils/errors');
const { ACTIONS, ENTITIES } = require('../../../utils/constants');
const activityLogService = require('../../../services/activityLog.service');

// ─────────────────────────────────────────────────────────────
// GET /employees — Admin only
// Returns all users with department info
// ─────────────────────────────────────────────────────────────
const getEmployees = async () => {
  const { rows } = await pool.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.status,
      u.department_id    AS "departmentId",
      d.name             AS "departmentName",
      u.created_at       AS "createdAt",
      u.updated_at       AS "updatedAt"
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    ORDER BY u.created_at DESC
  `);
  return rows;
};

// ─────────────────────────────────────────────────────────────
// PATCH /employees/:id — update profile (name / department only)
// Role changes are FORBIDDEN through this endpoint.
// ─────────────────────────────────────────────────────────────
const updateEmployee = async (id, updates, updatedBy) => {
  const { name, department_id } = updates;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify employee exists
    const { rows: current } = await client.query(
      'SELECT * FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (current.length === 0) throw new NotFoundError('Employee not found');
    const emp = current[0];

    // 2. If department_id is being updated, verify the department exists
    if (department_id !== undefined) {
      const deptCheck = await client.query(
        'SELECT id FROM departments WHERE id = $1',
        [department_id]
      );
      if (deptCheck.rows.length === 0) throw new NotFoundError('Department not found');
    }

    const finalName   = name          !== undefined ? name          : emp.name;
    const finalDeptId = department_id !== undefined ? department_id : emp.department_id;

    const { rows: updated } = await client.query(
      `UPDATE users
       SET name = $1, department_id = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, email, role, status, department_id AS "departmentId", updated_at AS "updatedAt"`,
      [finalName, finalDeptId, id]
    );

    // 3. Activity log
    await activityLogService.createLog(client, {
      userId:     updatedBy,
      action:     ACTIONS.EMPLOYEE_UPDATED,
      entityType: ENTITIES.EMPLOYEE,
      entityId:   id,
      metadata:   { oldName: emp.name, newName: finalName },
    });

    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /employees/:id/role — ADMIN ONLY
// Role changes happen ONLY through this endpoint.
// ─────────────────────────────────────────────────────────────
const updateRole = async (id, newRole, changedBy) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and lock
    const { rows } = await client.query(
      'SELECT id, name, role, status FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (rows.length === 0) throw new NotFoundError('Employee not found');
    const emp = rows[0];

    // 2. Same-role check (re-checked inside transaction)
    if (emp.role === newRole) {
      throw new ConflictError(`Employee already has role '${newRole}'`);
    }

    // 3. Perform update
    const { rows: updated } = await client.query(
      `UPDATE users SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, role, status`,
      [newRole, id]
    );

    // 4. Activity log
    await activityLogService.createLog(client, {
      userId:     changedBy,
      action:     ACTIONS.EMPLOYEE_ROLE_CHANGED,
      entityType: ENTITIES.EMPLOYEE,
      entityId:   id,
      metadata:   { oldRole: emp.role, newRole },
    });

    // NOTE: notification_type DB enum has no 'role_changed' value.
    // Role change is recorded in the activity log only.

    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /employees/:id/status — ADMIN ONLY
// Deactivation only — no permanent delete.
// ─────────────────────────────────────────────────────────────
const updateStatus = async (id, newStatus, changedBy) => {
  // Prevent self-deactivation (service-layer guard — never trust only the route)
  if (id === changedBy) {
    throw new ConflictError('You cannot deactivate your own account');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and lock
    const { rows } = await client.query(
      'SELECT id, name, status FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (rows.length === 0) throw new NotFoundError('Employee not found');
    const emp = rows[0];

    // 2. Already in requested status?
    if (emp.status === newStatus) {
      throw new ConflictError(`Employee is already '${newStatus}'`);
    }

    // 3. Deactivation-specific guards (only relevant when deactivating)
    if (newStatus === 'inactive') {
      // Check active allocations
      const { rows: allocRows } = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM allocations
         WHERE employee_id = $1 AND status = 'active'`,
        [id]
      );
      if (allocRows[0].cnt > 0) {
        throw new ConflictError(
          `Cannot deactivate: employee has ${allocRows[0].cnt} active allocation(s)`
        );
      }

      // Check active/upcoming bookings
      const { rows: bookingRows } = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM bookings
         WHERE booked_by = $1 AND status IN ('upcoming', 'ongoing')`,
        [id]
      );
      if (bookingRows[0].cnt > 0) {
        throw new ConflictError(
          `Cannot deactivate: employee has ${bookingRows[0].cnt} active/upcoming booking(s)`
        );
      }
    }

    // 4. Perform update
    const { rows: updated } = await client.query(
      `UPDATE users SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, role, status`,
      [newStatus, id]
    );

    // 5. Activity log
    await activityLogService.createLog(client, {
      userId:     changedBy,
      action:     ACTIONS.EMPLOYEE_DEACTIVATED,
      entityType: ENTITIES.EMPLOYEE,
      entityId:   id,
      metadata:   { oldStatus: emp.status, newStatus },
    });

    // NOTE: notification_type DB enum has no 'employee_deactivated' value.
    // Deactivation is recorded in the activity log only.

    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { getEmployees, updateEmployee, updateRole, updateStatus };
