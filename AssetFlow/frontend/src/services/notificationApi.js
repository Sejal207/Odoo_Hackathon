// ─────────────────────────────────────────────────────────────
// notificationApi.js
// All API calls for the Notifications module.
// Base: /api/notifications
// ─────────────────────────────────────────────────────────────
import apiClient from './apiClient';

/**
 * GET /api/notifications
 * Returns { notifications: [], pagination: { total, page, limit, totalPages } }
 */
export const getNotifications = ({ page = 1, limit = 20, unread } = {}) => {
  const params = { page, limit };
  if (unread !== undefined) params.unread = unread;
  return apiClient.get('/notifications', { params }).then((r) => r.data.data);
};

/**
 * PATCH /api/notifications/:id/read
 */
export const markAsRead = (id) =>
  apiClient.patch(`/notifications/${id}/read`).then((r) => r.data.data);
