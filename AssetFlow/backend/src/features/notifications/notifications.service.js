// ============================================================
// notifications.service.js
// Business logic for Notifications. Handled with database transactions.
// ============================================================

const { pool } = require('../../config/db');
const { NotFoundError, ForbiddenError, ConflictError } = require('../../utils/errors');
const activityLogService = require('../../services/activityLog.service');

/**
 * Gets paginated notifications for the authenticated user.
 * Supports filtering by unread status.
 *
 * @param {string} userId - Auth user UUID
 * @param {object} query  - { page, limit, unread }
 */
const getNotifications = async (userId, { page, limit, unread }) => {
  // Defensive parse — validation middleware may not mutate req.query in Express 5
  // when the key was not originally present in the URL, so we guard here.
  const safePage  = Math.max(1, parseInt(page,  10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset    = (safePage - 1) * safeLimit;

  let queryText = `
    SELECT
      id,
      user_id AS "userId",
      type,
      message,
      is_read AS "isRead",
      related_entity_type AS "relatedEntityType",
      related_entity_id AS "relatedEntityId",
      created_at AS "createdAt"
    FROM notifications
    WHERE user_id = $1
  `;
  const params = [userId];

  if (unread) {
    queryText += ' AND is_read = FALSE';
  }

  // Count query for total notifications to support pagination metadata
  let countQueryText = `SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1`;
  if (unread) {
    countQueryText += ' AND is_read = FALSE';
  }

  const [countResult, dataResult] = await Promise.all([
    pool.query(countQueryText, params),
    pool.query(
      queryText + ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [...params, safeLimit, offset]
    ),
  ]);

  const total = countResult.rows[0]?.total ?? 0;
  const totalPages = Math.ceil(total / safeLimit);

  return {
    notifications: dataResult.rows,
    pagination: {
      total,
      page:  safePage,
      limit: safeLimit,
      totalPages,
    },
  };
};

/**
 * Marks a notification as read inside a database transaction.
 * Re-checks state inside the transaction to prevent race conditions/double reading.
 *
 * @param {string} id     - Notification UUID
 * @param {string} userId - Authenticated user UUID
 */
const markAsRead = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch current state inside transaction with row locking (FOR UPDATE)
    const { rows } = await client.query(
      `SELECT * FROM notifications WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Notification not found');
    }

    const notification = rows[0];

    // 2. Access control: Must belong to current user
    if (notification.user_id !== userId) {
      throw new ForbiddenError('Access denied: Cannot modify another user\'s notification');
    }

    // 3. Prevent marking already-read notifications as read
    if (notification.is_read) {
      throw new ConflictError('Notification is already marked as read');
    }

    // 4. Perform the update
    const updateResult = await client.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1
       RETURNING
         id,
         user_id AS "userId",
         type,
         message,
         is_read AS "isRead",
         related_entity_type AS "relatedEntityType",
         related_entity_id AS "relatedEntityId",
         created_at AS "createdAt"`,
      [id]
    );

    const updatedNotification = updateResult.rows[0];

    // 5. Create activity log inside same transaction
    await activityLogService.createLog(client, {
      userId,
      action:     'notification.read',
      entityType: 'notification',
      entityId:   id,
      metadata:   { notificationId: id, previousState: { is_read: false }, newState: { is_read: true } },
    });

    await client.query('COMMIT');
    return updatedNotification;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getNotifications,
  markAsRead,
};
