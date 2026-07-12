// ============================================================
// category.service.js
// All business logic for Asset Categories.
// ============================================================

const { pool } = require('../../../config/db');
const { ConflictError, NotFoundError } = require('../../../utils/errors');
const { ACTIONS, ENTITIES } = require('../../../utils/constants');
const activityLogService = require('../../../services/activityLog.service');

// ─────────────────────────────────────────────────────────────
// GET /categories
// Accessible by: ADMIN, ASSET_MANAGER, DEPARTMENT_HEAD
// ─────────────────────────────────────────────────────────────
const getCategories = async () => {
  const { rows } = await pool.query(`
    SELECT
      ac.id,
      ac.name,
      ac.custom_fields   AS "customFields",
      ac.created_at      AS "createdAt",
      ac.updated_at      AS "updatedAt",
      COUNT(a.id)::int   AS "assetCount"
    FROM asset_categories ac
    LEFT JOIN assets a ON a.category_id = ac.id
    GROUP BY ac.id
    ORDER BY ac.created_at DESC
  `);
  return rows;
};

// ─────────────────────────────────────────────────────────────
// POST /categories
// Accessible by: ADMIN ONLY
// ─────────────────────────────────────────────────────────────
const createCategory = async ({ name, description, customFields }, createdBy) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Case-insensitive unique name check
    const nameCheck = await client.query(
      'SELECT id FROM asset_categories WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    if (nameCheck.rows.length > 0) {
      throw new ConflictError(`Category name '${name}' already exists`);
    }

    // 2. Insert — store description/icon inside custom_fields JSON
    const fields = customFields ?? (description ? { description } : {});
    const { rows } = await client.query(
      `INSERT INTO asset_categories (name, custom_fields)
       VALUES ($1, $2)
       RETURNING *`,
      [name, JSON.stringify(fields)]
    );
    const category = rows[0];

    // 3. Activity log
    await activityLogService.createLog(client, {
      userId:     createdBy,
      action:     ACTIONS.CATEGORY_CREATED,
      entityType: ENTITIES.CATEGORY,
      entityId:   category.id,
      metadata:   { name: category.name },
    });

    await client.query('COMMIT');
    return category;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /categories/:id
// Accessible by: ADMIN ONLY
// ─────────────────────────────────────────────────────────────
const updateCategory = async (id, updates, updatedBy) => {
  const { name, description, customFields } = updates;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch current (lock row)
    const { rows: current } = await client.query(
      'SELECT * FROM asset_categories WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (current.length === 0) throw new NotFoundError('Category not found');
    const cat = current[0];

    // 2. Unique name check only if name is being changed
    if (name !== undefined && name.toLowerCase() !== cat.name.toLowerCase()) {
      const nameCheck = await client.query(
        'SELECT id FROM asset_categories WHERE LOWER(name) = LOWER($1) AND id != $2',
        [name, id]
      );
      if (nameCheck.rows.length > 0) {
        throw new ConflictError(`Category name '${name}' already exists`);
      }
    }

    const finalName      = name !== undefined ? name : cat.name;
    const existingFields = cat.custom_fields ?? {};
    // Merge: incoming customFields overrides; if only description given, patch it in
    const incomingFields = customFields ?? (description !== undefined
      ? { ...existingFields, description }
      : existingFields);
    const finalCustomFields = JSON.stringify(incomingFields);

    const { rows: updated } = await client.query(
      `UPDATE asset_categories
       SET name = $1, custom_fields = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [finalName, finalCustomFields, id]
    );

    // 3. Activity log
    await activityLogService.createLog(client, {
      userId:     updatedBy,
      action:     ACTIONS.CATEGORY_UPDATED,
      entityType: ENTITIES.CATEGORY,
      entityId:   id,
      metadata:   { oldName: cat.name, newName: finalName },
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
// PATCH /categories/:id/deactivate
// Accessible by: ADMIN ONLY
// asset_categories has no status/is_active column in the live schema;
// blocks removal only when active assets still reference this category.
// NOTE: CATEGORY_DEACTIVATED is NOT a valid notification_type DB enum
//       value, so we skip notificationService here.
// ─────────────────────────────────────────────────────────────
const deactivateCategory = async (id, deactivatedBy) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and lock
    const { rows } = await client.query(
      'SELECT * FROM asset_categories WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (rows.length === 0) throw new NotFoundError('Category not found');
    const cat = rows[0];

    // 2. Block if active assets reference this category
    const { rows: assetRows } = await client.query(
      `SELECT COUNT(*)::int AS asset_count
       FROM assets
       WHERE category_id = $1 AND status NOT IN ('retired', 'disposed')`,
      [id]
    );
    const assetCount = assetRows[0].asset_count;

    if (assetCount > 0) {
      const err = new ConflictError(
        `Cannot deactivate category: ${assetCount} active asset(s) still use it`
      );
      err.meta = { asset_count: assetCount };
      throw err;
    }

    // 3. Activity log only (no notification — invalid enum value)
    await activityLogService.createLog(client, {
      userId:     deactivatedBy,
      action:     ACTIONS.CATEGORY_DEACTIVATED,
      entityType: ENTITIES.CATEGORY,
      entityId:   id,
      metadata:   { name: cat.name },
    });

    await client.query('COMMIT');
    return cat;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
};
