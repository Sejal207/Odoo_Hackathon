/**
 * Assets Repository — raw parameterized SQL via `pg`, no business logic.
 */
const { pool, query } = require('../../config/db');

/**
 * Get the next asset tag number (AF-0001, AF-0002, etc.)
 */
async function getNextAssetTag() {
  const { rows } = await query(
    `SELECT asset_tag FROM assets ORDER BY created_at DESC LIMIT 1`
  );
  if (rows.length === 0) return 'AF-0001';
  const lastNum = parseInt(rows[0].asset_tag.replace('AF-', ''), 10);
  return `AF-${String(lastNum + 1).padStart(4, '0')}`;
}

/**
 * Insert a new asset.
 */
async function create(data) {
  const { rows } = await query(
    `INSERT INTO assets (
      asset_tag, name, category_id, serial_number, qr_code,
      acquisition_date, acquisition_cost, condition, location,
      department_id, photo_url, document_urls, custom_field_values,
      is_bookable, status, created_by
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, $16
    ) RETURNING *`,
    [
      data.asset_tag, data.name, data.category_id, data.serial_number || null, data.qr_code || null,
      data.acquisition_date || null, data.acquisition_cost || null, data.condition || 'new', data.location || null,
      data.department_id || null, data.photo_url || null, JSON.stringify(data.document_urls || []), JSON.stringify(data.custom_field_values || {}),
      data.is_bookable || false, 'available', data.created_by,
    ]
  );
  return rows[0];
}

/**
 * Find asset by ID.
 */
async function findById(id) {
  const { rows } = await query(
    `SELECT a.*, ac.name AS category_name, d.name AS department_name,
            al.id AS allocation_id,
            COALESCE(NULLIF(u.name, ''), u.email, 'Employee #' || al.employee_id) AS employee_name,
            al.employee_id
     FROM assets a
     LEFT JOIN asset_categories ac ON a.category_id = ac.id
     LEFT JOIN departments d ON a.department_id = d.id
     LEFT JOIN allocations al ON al.asset_id = a.id AND al.status = 'active'
     LEFT JOIN users u ON al.employee_id = u.id
     WHERE a.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Find asset by ID (raw, no joins — for internal state checks).
 */
async function findByIdRaw(id) {
  const { rows } = await query(`SELECT * FROM assets WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Find asset by asset_tag.
 */
async function findByAssetTag(tag) {
  const { rows } = await query(`SELECT * FROM assets WHERE asset_tag = $1`, [tag]);
  return rows[0] || null;
}

/**
 * List assets with filters and pagination.
 */
async function findAll(filters, limit, offset) {
  const conditions = [];
  const values = [];
  let idx = 1;

  const searchTerm = filters.tag || filters.serial;
  if (searchTerm) {
    conditions.push(`(
      a.asset_tag ILIKE $${idx}
      OR a.name ILIKE $${idx}
      OR COALESCE(a.serial_number, '') ILIKE $${idx}
      OR COALESCE(a.qr_code, '') ILIKE $${idx}
    )`);
    values.push(`%${searchTerm}%`);
    idx += 1;
  }
  if (filters.category) {
    conditions.push(`a.category_id = $${idx++}`);
    values.push(filters.category);
  }
  if (filters.status) {
    conditions.push(`a.status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters.department) {
    conditions.push(`a.department_id = $${idx++}`);
    values.push(filters.department);
  }
  if (filters.location) {
    conditions.push(`a.location ILIKE $${idx++}`);
    values.push(`%${filters.location}%`);
  }
  if (filters.is_bookable !== undefined && filters.is_bookable !== '') {
    conditions.push(`a.is_bookable = $${idx++}`);
    values.push(filters.is_bookable === 'true' || filters.is_bookable === true);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM assets a ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  values.push(limit);
  values.push(offset);

  const { rows } = await query(
    `SELECT a.*, ac.name AS category_name, d.name AS department_name,
            al.id AS allocation_id,
            COALESCE(NULLIF(u.name, ''), u.email, 'Employee #' || al.employee_id) AS employee_name,
            al.employee_id
     FROM assets a
     LEFT JOIN asset_categories ac ON a.category_id = ac.id
     LEFT JOIN departments d ON a.department_id = d.id
     LEFT JOIN allocations al ON al.asset_id = a.id AND al.status = 'active'
     LEFT JOIN users u ON al.employee_id = u.id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    values
  );

  return { rows, total };
}

/**
 * Update asset fields by ID.
 */
async function updateById(id, data) {
  const setClauses = [];
  const values = [];
  let idx = 1;

  const allowedFields = [
    'name', 'category_id', 'serial_number', 'qr_code',
    'acquisition_date', 'acquisition_cost', 'condition', 'location',
    'department_id', 'photo_url', 'document_urls', 'custom_field_values',
    'is_bookable', 'status',
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      if (field === 'document_urls' || field === 'custom_field_values') {
        setClauses.push(`${field} = $${idx++}`);
        values.push(JSON.stringify(data[field]));
      } else {
        setClauses.push(`${field} = $${idx++}`);
        values.push(data[field]);
      }
    }
  }

  if (setClauses.length === 0) return findById(id);

  values.push(id);

  const { rows } = await query(
    `UPDATE assets SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0] || null;
}

/**
 * Update asset status (used by other modules via service layer).
 * @param {Object} client - pg client (for transaction support)
 */
async function updateStatus(id, status, client = null) {
  const queryFn = client || { query: (text, params) => query(text, params) };
  const { rows } = await queryFn.query(
    `UPDATE assets SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] || null;
}

/**
 * Get merged allocation + maintenance history for an asset.
 */
async function getHistory(assetId) {
  const allocations = await query(
    `SELECT al.*, u.name AS employee_name, ab.name AS allocated_by_name
     FROM allocations al
     LEFT JOIN users u ON al.employee_id = u.id
     LEFT JOIN users ab ON al.allocated_by = ab.id
     WHERE al.asset_id = $1
     ORDER BY al.allocated_date DESC`,
    [assetId]
  );

  const maintenance = await query(
    `SELECT mr.*, u.name AS raised_by_name, ab.name AS approved_by_name
     FROM maintenance_requests mr
     LEFT JOIN users u ON mr.raised_by = u.id
     LEFT JOIN users ab ON mr.approved_by = ab.id
     WHERE mr.asset_id = $1
     ORDER BY mr.created_at DESC`,
    [assetId]
  );

  return {
    allocations: allocations.rows,
    maintenance: maintenance.rows,
  };
}

async function getMetadata() {
  const [categoriesResult, departmentsResult] = await Promise.all([
    query(
      `SELECT id, name
       FROM asset_categories
       ORDER BY name ASC`
    ),
    query(
      `SELECT id, name
       FROM departments
       ORDER BY name ASC`
    ),
  ]);

  return {
    categories: categoriesResult.rows,
    departments: departmentsResult.rows,
  };
}

module.exports = {
  getNextAssetTag,
  create,
  findById,
  findByIdRaw,
  findByAssetTag,
  findAll,
  updateById,
  updateStatus,
  getHistory,
  getMetadata,
};
