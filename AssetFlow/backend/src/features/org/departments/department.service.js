// ============================================================
// department.service.js
// All business logic for departments lives here.
// Controllers must remain thin — no SQL, no business logic there.
// ============================================================

const { pool } = require('../../../config/db');
const {
  ConflictError,
  NotFoundError,
  ValidationError,
} = require('../../../utils/errors');
const { ACTIONS, ENTITIES } = require('../../../utils/constants');
const activityLogService = require('../../../services/activityLog.service');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Recursively walks the parent chain to detect circular references.
 * Returns true if candidateParentId is a descendant of departmentId.
 *
 * @param {object} client
 * @param {string} departmentId      - The department UUID being updated
 * @param {string} candidateParentId - The proposed new parent UUID
 */
const wouldCreateCycle = async (client, departmentId, candidateParentId) => {
  let currentId = candidateParentId;
  const visited = new Set();

  while (currentId !== null) {
    if (currentId === departmentId) return true;
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const { rows } = await client.query(
      'SELECT parent_department_id FROM departments WHERE id = $1',
      [currentId]
    );
    if (rows.length === 0) break;
    currentId = rows[0].parent_department_id;
  }
  return false;
};

// ─────────────────────────────────────────────────────────────
// GET /departments
// Live schema: id, name, head_user_id, parent_department_id,
//              status (active_status enum), created_at, updated_at
// ─────────────────────────────────────────────────────────────
const getDepartments = async () => {
  const { rows } = await pool.query(`
    SELECT
      d.id,
      d.name,
      d.head_user_id            AS "headUserId",
      u.name                    AS "headUserName",
      d.parent_department_id    AS "parentDepartmentId",
      pd.name                   AS "parentDepartmentName",
      d.status,
      d.created_at              AS "createdAt",
      d.updated_at              AS "updatedAt",
      COUNT(DISTINCT emp.id)    FILTER (WHERE emp.status = 'active')                      AS "employeeCount",
      COUNT(DISTINCT a.id)      FILTER (WHERE a.status NOT IN ('retired', 'disposed'))    AS "assetCount"
    FROM departments d
    LEFT JOIN users u   ON u.id = d.head_user_id
    LEFT JOIN departments pd ON pd.id = d.parent_department_id
    LEFT JOIN users emp  ON emp.department_id = d.id
    LEFT JOIN assets a   ON a.department_id = d.id
    GROUP BY d.id, u.name, pd.name
    ORDER BY d.created_at DESC
  `);
  return rows;
};

// ─────────────────────────────────────────────────────────────
// POST /departments
// Accessible by: ADMIN ONLY
// ─────────────────────────────────────────────────────────────
const createDepartment = async ({ name, parent_department_id }, createdBy) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Unique name check (case-insensitive)
    const nameCheck = await client.query(
      'SELECT id FROM departments WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    if (nameCheck.rows.length > 0) {
      throw new ConflictError(`Department name '${name}' already exists`);
    }

    // 2. Parent existence check
    if (parent_department_id) {
      const parentCheck = await client.query(
        'SELECT id, status FROM departments WHERE id = $1',
        [parent_department_id]
      );
      if (parentCheck.rows.length === 0) {
        throw new NotFoundError('Parent department not found');
      }
    }

    // 3. Insert — live schema has no created_by/updated_by columns
    const { rows } = await client.query(
      `INSERT INTO departments (name, parent_department_id)
       VALUES ($1, $2)
       RETURNING *`,
      [name, parent_department_id || null]
    );
    const department = rows[0];

    // 4. Activity log
    await activityLogService.createLog(client, {
      userId:     createdBy,
      action:     ACTIONS.DEPARTMENT_CREATED,
      entityType: ENTITIES.DEPARTMENT,
      entityId:   department.id,
      metadata:   { name: department.name },
    });

    await client.query('COMMIT');
    return department;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /departments/:id
// Accessible by: ADMIN ONLY
// ─────────────────────────────────────────────────────────────
const updateDepartment = async (id, updates, updatedBy) => {
  const { name, parent_department_id } = updates;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch current department (lock row for update)
    const { rows: current } = await client.query(
      'SELECT * FROM departments WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (current.length === 0) throw new NotFoundError('Department not found');
    const dept = current[0];

    // 2. Unique name check if name is being changed
    if (name !== undefined && name.toLowerCase() !== dept.name.toLowerCase()) {
      const nameCheck = await client.query(
        'SELECT id FROM departments WHERE LOWER(name) = LOWER($1) AND id != $2',
        [name, id]
      );
      if (nameCheck.rows.length > 0) {
        throw new ConflictError(`Department name '${name}' already exists`);
      }
    }

    // 3. Parent validation
    const newParent = parent_department_id !== undefined ? parent_department_id : dept.parent_department_id;
    if (newParent !== null && newParent !== undefined) {
      // Self-parent check
      if (newParent === id) {
        throw new ValidationError('A department cannot be its own parent');
      }

      // Parent existence check
      const parentCheck = await client.query(
        'SELECT id FROM departments WHERE id = $1',
        [newParent]
      );
      if (parentCheck.rows.length === 0) {
        throw new NotFoundError('Parent department not found');
      }

      // Circular hierarchy check
      const cycleDetected = await wouldCreateCycle(client, id, newParent);
      if (cycleDetected) {
        throw new ConflictError('Setting this parent would create a circular department hierarchy');
      }
    }

    // 4. Build update — live schema has no updated_by column
    const finalName   = name !== undefined ? name : dept.name;
    const finalParent = parent_department_id !== undefined ? parent_department_id : dept.parent_department_id;

    const { rows: updated } = await client.query(
      `UPDATE departments
       SET name = $1, parent_department_id = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [finalName, finalParent, id]
    );

    // 5. Activity log
    await activityLogService.createLog(client, {
      userId:     updatedBy,
      action:     ACTIONS.DEPARTMENT_UPDATED,
      entityType: ENTITIES.DEPARTMENT,
      entityId:   id,
      metadata:   { oldName: dept.name, newName: finalName },
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
// PATCH /departments/:id/deactivate
// Accessible by: ADMIN ONLY
// Note: live schema uses status (active_status enum) not is_active boolean
// ─────────────────────────────────────────────────────────────
const deactivateDepartment = async (id, deactivatedBy) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and lock the department
    const { rows } = await client.query(
      'SELECT * FROM departments WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (rows.length === 0) throw new NotFoundError('Department not found');
    const dept = rows[0];

    // 2. Already inactive? (live schema uses status enum, not is_active boolean)
    if (dept.status !== 'active') {
      throw new ConflictError('Department is already inactive');
    }

    // 3. Check active employees
    const { rows: empRows } = await client.query(
      `SELECT COUNT(*)::int AS employee_count
       FROM users
       WHERE department_id = $1 AND status = 'active'`,
      [id]
    );
    const employeeCount = empRows[0].employee_count;

    // 4. Check active assets
    const { rows: assetRows } = await client.query(
      `SELECT COUNT(*)::int AS asset_count
       FROM assets
       WHERE department_id = $1 AND status NOT IN ('retired', 'disposed')`,
      [id]
    );
    const assetCount = assetRows[0].asset_count;

    // 5. Block deactivation if dependencies exist
    if (employeeCount > 0 || assetCount > 0) {
      const err = new ConflictError(
        'Cannot deactivate department: active employees or assets are assigned to it'
      );
      err.meta = { employee_count: employeeCount, asset_count: assetCount };
      throw err;
    }

    // 6. Deactivate — use status enum, no updated_by column in live schema
    const { rows: updated } = await client.query(
      `UPDATE departments
       SET status = 'inactive', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // 7. Activity log
    await activityLogService.createLog(client, {
      userId:     deactivatedBy,
      action:     ACTIONS.DEPARTMENT_DEACTIVATED,
      entityType: ENTITIES.DEPARTMENT,
      entityId:   id,
      metadata:   { name: dept.name, previousStatus: dept.status },
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

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
};
