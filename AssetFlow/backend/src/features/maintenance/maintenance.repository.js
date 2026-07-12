/**
 * Maintenance Repository — raw parameterized SQL via `pg`.
 */
const { pool, query } = require('../../config/db');

async function create(data) {
  const { rows } = await query(
    `INSERT INTO maintenance_requests (
      asset_id, raised_by, issue_description, priority, photo_url, status
    ) VALUES ($1, $2, $3, $4, $5, 'pending')
    RETURNING *`,
    [data.asset_id, data.raised_by, data.issue_description, data.priority || 'medium', data.photo_url || null]
  );
  return rows[0];
}

async function findById(id, client = null) {
  const queryFn = client || { query: (t, p) => query(t, p) };
  const { rows } = await queryFn.query(
    `SELECT mr.*, a.asset_tag, a.status AS asset_status, a.department_id AS asset_department_id,
            u.name AS raised_by_name, ab.name AS approved_by_name
     FROM maintenance_requests mr
     LEFT JOIN assets a ON mr.asset_id = a.id
     LEFT JOIN users u ON mr.raised_by = u.id
     LEFT JOIN users ab ON mr.approved_by = ab.id
     WHERE mr.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findActiveByAssetId(assetId) {
  const { rows } = await query(
    `SELECT id FROM maintenance_requests
     WHERE asset_id = $1 AND status NOT IN ('resolved', 'rejected')
     LIMIT 1`,
    [assetId]
  );
  return rows[0] || null;
}

async function updateStatus(id, status, extraFields = {}, client = null) {
  const queryFn = client || { query: (t, p) => query(t, p) };
  const setClauses = ['status = $1'];
  const values = [status];
  let idx = 2;

  if (extraFields.approved_by !== undefined) {
    setClauses.push(`approved_by = $${idx++}`);
    values.push(extraFields.approved_by);
  }
  if (extraFields.technician_name !== undefined) {
    setClauses.push(`technician_name = $${idx++}`);
    values.push(extraFields.technician_name);
  }
  if (extraFields.resolved_at !== undefined) {
    setClauses.push(`resolved_at = $${idx++}`);
    values.push(extraFields.resolved_at);
  }
  if (extraFields.resolution_notes !== undefined) {
    setClauses.push(`resolution_notes = $${idx++}`);
    values.push(extraFields.resolution_notes);
  }

  values.push(id);
  const { rows } = await queryFn.query(
    `UPDATE maintenance_requests SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function findByAssetId(assetId, limit, offset) {
  const countResult = await query(
    `SELECT COUNT(*) AS total FROM maintenance_requests WHERE asset_id = $1`,
    [assetId]
  );
  const total = parseInt(countResult.rows[0].total, 10);

  const { rows } = await query(
    `SELECT mr.*, u.name AS raised_by_name, ab.name AS approved_by_name
     FROM maintenance_requests mr
     LEFT JOIN users u ON mr.raised_by = u.id
     LEFT JOIN users ab ON mr.approved_by = ab.id
     WHERE mr.asset_id = $1
     ORDER BY mr.created_at DESC
     LIMIT $2 OFFSET $3`,
    [assetId, limit, offset]
  );
  return { rows, total };
}

module.exports = { create, findById, findActiveByAssetId, updateStatus, findByAssetId };
