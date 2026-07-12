// ============================================================
// booking.service.js
// All business logic for Resource Booking.
//
// Schema facts (from assetflow_schema.sql):
//   bookings: id, asset_id, booked_by, department_id, start_time,
//             end_time, status (booking_status enum), created_at
//   NOTE: bookings has NO updated_at column — never include it in SET.
//   DB enforces:
//     - CHECK (end_time > start_time)
//     - EXCLUDE USING gist (...) WHERE (status IN ('upcoming','ongoing'))
//       → DB is the final backstop; the service pre-guards for cleaner errors.
// ============================================================

const { pool } = require('../../config/db');
const {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} = require('../../utils/errors');
const { ACTIONS, ENTITIES, BOOKING_STATUS, NOTIFICATION_TYPES, ROLES } = require('../../utils/constants');
const activityLogService  = require('../../services/activityLog.service');
const notificationService = require('../../services/notification.service');

// ─────────────────────────────────────────────────────────────────────────────
// Internal: check for overlapping ACTIVE bookings on the same asset.
// Overlap condition: NOT (newEnd <= existingStart OR newStart >= existingEnd)
//   ≡ existingStart < newEnd AND existingEnd > newStart
// excludeId: when rescheduling, exclude the booking's own row.
// ─────────────────────────────────────────────────────────────────────────────
const checkOverlap = async (client, assetId, startTime, endTime, excludeId = null) => {
  let query = `
    SELECT id FROM bookings
    WHERE asset_id = $1
      AND status   IN ('upcoming', 'ongoing')
      AND start_time < $3
      AND end_time   > $2
  `;
  const params = [assetId, startTime, endTime];

  if (excludeId) {
    query  += ` AND id != $4`;
    params.push(excludeId);
  }

  const { rows } = await client.query(query, params);
  return rows.length > 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /bookings
// ─────────────────────────────────────────────────────────────────────────────
const createBooking = async (userId, { asset_id, start_time, end_time, purpose }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch asset and lock it to prevent concurrent state changes
    const { rows: assetRows } = await client.query(
      `SELECT id, name, is_bookable, status, department_id FROM assets WHERE id = $1 FOR UPDATE`,
      [asset_id]
    );
    if (assetRows.length === 0) throw new NotFoundError('Asset not found');
    const asset = assetRows[0];

    // 2. Edge case: asset not bookable
    if (!asset.is_bookable) {
      throw new ValidationError('This asset is not available for booking');
    }

    // 3. Edge case: asset under maintenance (409 — not a bad request, a state conflict)
    if (asset.status === 'under_maintenance') {
      throw new ConflictError('Asset is currently under maintenance and cannot be booked');
    }

    // 4. Edge case: asset retired/disposed (also a conflict)
    if (asset.status === 'retired' || asset.status === 'disposed') {
      throw new ConflictError(`Asset is ${asset.status} and cannot be booked`);
    }

    // 5. Edge case: booking overlap (checked INSIDE the transaction)
    const hasOverlap = await checkOverlap(client, asset_id, start_time, end_time);
    if (hasOverlap) {
      throw new ConflictError('The requested time slot overlaps with an existing booking for this asset');
    }

    // 6. Fetch the user's department_id to denormalise onto the booking row
    const { rows: userRows } = await client.query(
      'SELECT department_id FROM users WHERE id = $1',
      [userId]
    );
    const departmentId = userRows[0]?.department_id ?? null;

    // 7. Insert booking
    const { rows: bookingRows } = await client.query(
      `INSERT INTO bookings (asset_id, booked_by, department_id, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, 'upcoming')
       RETURNING *`,
      [asset_id, userId, departmentId, start_time, end_time]
    );
    const booking = bookingRows[0];

    // 8. Activity log (inside same transaction)
    await activityLogService.createLog(client, {
      userId,
      action:     ACTIONS.BOOKING_CREATED,
      entityType: ENTITIES.BOOKING,
      entityId:   booking.id,
      metadata:   {
        assetId:   asset_id,
        assetName: asset.name,
        startTime: start_time,
        endTime:   end_time,
      },
    });

    // 9. Notification to the booker (booking_confirmed is in the DB enum)
    await notificationService.create(client, {
      userId,
      type:              NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      message:           `Your booking for "${asset.name}" has been confirmed from ${new Date(start_time).toLocaleString()} to ${new Date(end_time).toLocaleString()}.`,
      relatedEntityType: ENTITIES.BOOKING,
      relatedEntityId:   booking.id,
    });

    await client.query('COMMIT');
    return booking;
  } catch (err) {
    await client.query('ROLLBACK');
    // Re-map the DB EXCLUDE constraint violation into a friendly 409
    if (err.code === '23P01') {
      throw new ConflictError('The requested time slot overlaps with an existing booking for this asset');
    }
    // Re-map the DB CHECK violation (end_time > start_time) — should never reach here after validation
    if (err.code === '23514') {
      throw new ValidationError('end_time must be after start_time');
    }
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /bookings?assetId=&from=&to=&page=&limit=
// Calendar view — shows bookings for a given asset in a time window.
// RBAC: employees see only their own; admins/asset_managers see all.
// ─────────────────────────────────────────────────────────────────────────────
const getBookings = async (userId, userRole, { assetId, from, to, page, limit }) => {
  const offset = (page - 1) * limit;

  // Build dynamic WHERE
  const conditions = [];
  const params     = [];
  let   i          = 1;

  const isPrivileged = [ROLES.ADMIN, ROLES.ASSET_MANAGER].includes(userRole);

  // Employees see only their own bookings
  if (!isPrivileged) {
    conditions.push(`b.booked_by = $${i++}`);
    params.push(userId);
  }

  if (assetId) {
    conditions.push(`b.asset_id = $${i++}`);
    params.push(assetId);
  }

  if (from) {
    conditions.push(`b.end_time > $${i++}`);
    params.push(from);
  }

  if (to) {
    conditions.push(`b.start_time < $${i++}`);
    params.push(to);
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM bookings b
    ${whereClause}
  `;

  const dataQuery = `
    SELECT
      b.id,
      b.asset_id       AS "assetId",
      a.name           AS "assetName",
      a.asset_tag      AS "assetTag",
      b.booked_by      AS "bookedBy",
      u.name           AS "bookedByName",
      b.department_id  AS "departmentId",
      d.name           AS "departmentName",
      b.start_time     AS "startTime",
      b.end_time       AS "endTime",
      b.status,
      b.created_at     AS "createdAt"
    FROM bookings b
    LEFT JOIN assets      a ON a.id = b.asset_id
    LEFT JOIN users       u ON u.id = b.booked_by
    LEFT JOIN departments d ON d.id = b.department_id
    ${whereClause}
    ORDER BY b.start_time ASC
    LIMIT $${i} OFFSET $${i + 1}
  `;

  const [countResult, dataResult] = await Promise.all([
    pool.query(countQuery, params),
    pool.query(dataQuery, [...params, limit, offset]),
  ]);

  const total      = countResult.rows[0]?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

  return {
    bookings: dataResult.rows,
    pagination: { total, page, limit, totalPages },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /bookings/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
const cancelBooking = async (id, userId, userRole) => {
  const isPrivileged = [ROLES.ADMIN, ROLES.ASSET_MANAGER].includes(userRole);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and lock the row — re-check state inside the transaction
    const { rows } = await client.query(
      `SELECT b.*, a.name AS "assetName"
       FROM bookings b
       LEFT JOIN assets a ON a.id = b.asset_id
       WHERE b.id = $1
       FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) throw new NotFoundError('Booking not found');
    const booking = rows[0];

    // 2. Edge case: ownership check
    if (!isPrivileged && booking.booked_by !== userId) {
      throw new ForbiddenError('You can only cancel your own bookings');
    }

    // 3. Edge case: already completed or cancelled (re-checked inside txn)
    if (booking.status === BOOKING_STATUS.COMPLETED) {
      throw new ConflictError('Cannot cancel a completed booking');
    }
    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new ConflictError('Booking is already cancelled');
    }

    // 4. Cancel
    const { rows: updated } = await client.query(
      `UPDATE bookings
       SET status = 'cancelled'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // 5. Activity log
    await activityLogService.createLog(client, {
      userId,
      action:     ACTIONS.BOOKING_CANCELLED,
      entityType: ENTITIES.BOOKING,
      entityId:   id,
      metadata:   {
        previousStatus: booking.status,
        assetId:        booking.asset_id,
        startTime:      booking.start_time,
        endTime:        booking.end_time,
      },
    });

    // 6. Notify the booker (if admin is cancelling someone else's booking)
    const notifyUserId = booking.booked_by || userId;
    await notificationService.create(client, {
      userId:            notifyUserId,
      type:              NOTIFICATION_TYPES.BOOKING_CANCELLED,
      message:           `Your booking for "${booking.assetName}" (${new Date(booking.start_time).toLocaleString()}) has been cancelled.`,
      relatedEntityType: ENTITIES.BOOKING,
      relatedEntityId:   id,
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /bookings/:id/reschedule
// ─────────────────────────────────────────────────────────────────────────────
const rescheduleBooking = async (id, userId, userRole, { start_time, end_time }) => {
  const isPrivileged = [ROLES.ADMIN, ROLES.ASSET_MANAGER].includes(userRole);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and lock the row — re-check state inside the transaction
    const { rows } = await client.query(
      `SELECT b.*, a.name AS "assetName"
       FROM bookings b
       LEFT JOIN assets a ON a.id = b.asset_id
       WHERE b.id = $1
       FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) throw new NotFoundError('Booking not found');
    const booking = rows[0];

    // 2. Edge case: ownership check
    if (!isPrivileged && booking.booked_by !== userId) {
      throw new ForbiddenError('You can only reschedule your own bookings');
    }

    // 3. Edge case: can only reschedule 'upcoming' bookings
    //    (ongoing, completed, cancelled cannot be rescheduled)
    if (booking.status !== BOOKING_STATUS.UPCOMING) {
      throw new ConflictError(
        `Cannot reschedule a ${booking.status} booking. Only 'upcoming' bookings can be rescheduled.`
      );
    }

    // 4. Edge case: reschedule overlap — exclude own booking row from the check
    const hasOverlap = await checkOverlap(client, booking.asset_id, start_time, end_time, id);
    if (hasOverlap) {
      throw new ConflictError('The new time slot overlaps with an existing booking for this asset');
    }

    // 5. Update — NOTE: bookings has NO updated_at column, so DO NOT include it
    const { rows: updated } = await client.query(
      `UPDATE bookings
       SET start_time = $1, end_time = $2
       WHERE id = $3
       RETURNING *`,
      [start_time, end_time, id]
    );

    // 6. Activity log
    await activityLogService.createLog(client, {
      userId,
      action:     ACTIONS.BOOKING_RESCHEDULED,
      entityType: ENTITIES.BOOKING,
      entityId:   id,
      metadata:   {
        assetId:      booking.asset_id,
        oldStartTime: booking.start_time,
        oldEndTime:   booking.end_time,
        newStartTime: start_time,
        newEndTime:   end_time,
      },
    });

    // 7. Notify the booker with re-confirmation
    const notifyUserId = booking.booked_by || userId;
    await notificationService.create(client, {
      userId:            notifyUserId,
      type:              NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      message:           `Your booking for "${booking.assetName}" has been rescheduled to ${new Date(start_time).toLocaleString()} – ${new Date(end_time).toLocaleString()}.`,
      relatedEntityType: ENTITIES.BOOKING,
      relatedEntityId:   id,
    });

    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    // Translate DB EXCLUDE constraint violation
    if (err.code === '23P01') {
      throw new ConflictError('The new time slot overlaps with an existing booking for this asset');
    }
    if (err.code === '23514') {
      throw new ValidationError('end_time must be after start_time');
    }
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { createBooking, getBookings, cancelBooking, rescheduleBooking };
