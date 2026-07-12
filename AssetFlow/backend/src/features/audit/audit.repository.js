/**
 * Audit Repository — raw parameterized SQL via `pg`.
 */
const { pool, query } = require('../../config/db');

// ─── Audit Cycles ─────────────────────────────────────────

async function createCycle(data) {
  const { rows } = await query(
    `INSERT INTO audit_cycles (name, scope_department_id, scope_location, start_date, end_date, status, created_by)
     VALUES ($1, $2, $3, $4, $5, 'planned', $6) RETURNING *`,
    [data.name, data.scope_department_id || null, data.scope_location || null,
     data.start_date, data.end_date, data.created_by]
  );
  return rows[0];
}

async function findCycleById(id, client = null) {
  const queryFn = client || { query: (t, p) => query(t, p) };
  const { rows } = await queryFn.query(
    `SELECT ac.*, d.name AS department_name, u.name AS created_by_name
     FROM audit_cycles ac
     LEFT JOIN departments d ON ac.scope_department_id = d.id
     LEFT JOIN users u ON ac.created_by = u.id
     WHERE ac.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function updateCycleStatus(id, status, client = null) {
  const queryFn = client || { query: (t, p) => query(t, p) };
  const { rows } = await queryFn.query(
    `UPDATE audit_cycles SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] || null;
}

/**
 * Atomically close: only if not already closed. Returns null if already closed.
 */
async function atomicClose(id, client) {
  const { rows } = await client.query(
    `UPDATE audit_cycles SET status = 'closed' WHERE id = $1 AND status != 'closed' RETURNING id`,
    [id]
  );
  return rows[0] || null;
}

// ─── Auditors ─────────────────────────────────────────────

async function addAuditors(cycleId, auditorIds) {
  const values = auditorIds.map((_, i) => `($1, $${i + 2})`).join(', ');
  const params = [cycleId, ...auditorIds];
  const { rows } = await query(
    `INSERT INTO audit_cycle_auditors (audit_cycle_id, auditor_id) VALUES ${values}
     ON CONFLICT DO NOTHING RETURNING *`,
    params
  );
  return rows;
}

async function isAuditor(cycleId, userId) {
  const { rows } = await query(
    `SELECT 1 FROM audit_cycle_auditors WHERE audit_cycle_id = $1 AND auditor_id = $2`,
    [cycleId, userId]
  );
  return rows.length > 0;
}

// ─── Audit Items ──────────────────────────────────────────

async function createItems(cycleId, assetIds) {
  if (!assetIds.length) return [];
  const values = assetIds.map((_, i) => `($1, $${i + 2}, 'pending')`).join(', ');
  const params = [cycleId, ...assetIds];
  const { rows } = await query(
    `INSERT INTO audit_items (audit_cycle_id, asset_id, result) VALUES ${values}
     ON CONFLICT DO NOTHING RETURNING *`,
    params
  );
  return rows;
}

async function findItemsByCycleId(cycleId, limit, offset) {
  const countRes = await query(
    `SELECT COUNT(*) AS total FROM audit_items WHERE audit_cycle_id = $1`, [cycleId]
  );
  const total = parseInt(countRes.rows[0].total, 10);

  const { rows } = await query(
    `SELECT ai.*, a.asset_tag, a.name AS asset_name, a.status AS asset_status,
            u.name AS audited_by_name
     FROM audit_items ai
     LEFT JOIN assets a ON ai.asset_id = a.id
     LEFT JOIN users u ON ai.audited_by = u.id
     WHERE ai.audit_cycle_id = $1
     ORDER BY ai.asset_id
     LIMIT $2 OFFSET $3`,
    [cycleId, limit, offset]
  );
  return { rows, total };
}

async function findItemById(id, client = null) {
  const queryFn = client || { query: (t, p) => query(t, p) };
  const { rows } = await queryFn.query(
    `SELECT ai.*, ac.status AS cycle_status, a.asset_tag, a.status AS asset_status
     FROM audit_items ai
     LEFT JOIN audit_cycles ac ON ai.audit_cycle_id = ac.id
     LEFT JOIN assets a ON ai.asset_id = a.id
     WHERE ai.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function updateItemResult(id, result, auditedBy, notes, client = null) {
  const queryFn = client || { query: (t, p) => query(t, p) };
  const { rows } = await queryFn.query(
    `UPDATE audit_items SET result = $1, audited_by = $2, notes = $3, audited_at = NOW()
     WHERE id = $4 RETURNING *`,
    [result, auditedBy, notes || null, id]
  );
  return rows[0] || null;
}

/**
 * Get all items with result IN ('missing', 'damaged') for a given cycle.
 */
async function findDiscrepantItems(cycleId, client) {
  const { rows } = await client.query(
    `SELECT ai.*, a.asset_tag, a.status AS asset_status
     FROM audit_items ai
     LEFT JOIN assets a ON ai.asset_id = a.id
     WHERE ai.audit_cycle_id = $1 AND ai.result IN ('missing', 'damaged')`,
    [cycleId]
  );
  return rows;
}

// ─── Discrepancy Reports ──────────────────────────────────

async function createDiscrepancyReport(data, client) {
  const { rows } = await client.query(
    `INSERT INTO discrepancy_reports (audit_cycle_id, asset_id, issue_type)
     VALUES ($1, $2, $3) RETURNING *`,
    [data.audit_cycle_id, data.asset_id, data.issue_type]
  );
  return rows[0];
}

async function findDiscrepanciesByCycleId(cycleId) {
  const { rows } = await query(
    `SELECT dr.*, a.asset_tag, a.name AS asset_name
     FROM discrepancy_reports dr
     LEFT JOIN assets a ON dr.asset_id = a.id
     WHERE dr.audit_cycle_id = $1
     ORDER BY dr.generated_at`,
    [cycleId]
  );
  return rows;
}

module.exports = {
  createCycle, findCycleById, updateCycleStatus, atomicClose,
  addAuditors, isAuditor,
  createItems, findItemsByCycleId, findItemById, updateItemResult, findDiscrepantItems,
  createDiscrepancyReport, findDiscrepanciesByCycleId,
};
