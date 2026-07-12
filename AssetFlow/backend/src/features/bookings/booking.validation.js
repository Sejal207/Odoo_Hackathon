// ============================================================
// booking.validation.js
// Manual validation — guards every booking endpoint.
// NOTE: The DB also enforces:
//   - CHECK (end_time > start_time)
//   - EXCLUDE USING gist (no overlapping active bookings)
// The service layer is the primary guard; DB is the backstop.
// ============================================================

const { ValidationError } = require('../../utils/errors');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUUID = (val) => typeof val === 'string' && UUID_REGEX.test(val);

const isValidISO = (val) => {
  if (!val || typeof val !== 'string') return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
};

// ─── POST /bookings ───────────────────────────────────────────
const validateCreateBooking = (req, res, next) => {
  const { asset_id, start_time, end_time, purpose } = req.body;

  if (!asset_id)             return next(new ValidationError('asset_id is required'));
  if (!isValidUUID(asset_id)) return next(new ValidationError('asset_id must be a valid UUID'));

  if (!start_time)            return next(new ValidationError('start_time is required'));
  if (!isValidISO(start_time)) return next(new ValidationError('start_time must be a valid ISO 8601 datetime'));

  if (!end_time)              return next(new ValidationError('end_time is required'));
  if (!isValidISO(end_time))  return next(new ValidationError('end_time must be a valid ISO 8601 datetime'));

  const start = new Date(start_time);
  const end   = new Date(end_time);
  const now   = new Date();

  // Edge case 1: end before start
  if (end <= start) {
    return next(new ValidationError('end_time must be after start_time'));
  }

  // Edge case 2: start in the past (prevent booking past slots)
  if (start <= now) {
    return next(new ValidationError('start_time must be in the future'));
  }

  if (purpose !== undefined && purpose !== null) {
    if (typeof purpose !== 'string') {
      return next(new ValidationError('purpose must be a string'));
    }
    if (purpose.trim().length > 500) {
      return next(new ValidationError('purpose must be at most 500 characters'));
    }
    req.body.purpose = purpose.trim();
  } else {
    req.body.purpose = null;
  }

  next();
};

// ─── GET /bookings ────────────────────────────────────────────
const validateGetBookings = (req, res, next) => {
  const { assetId, from, to } = req.query;

  if (assetId !== undefined && !isValidUUID(assetId)) {
    return next(new ValidationError('assetId must be a valid UUID'));
  }

  if (from !== undefined && !isValidISO(from)) {
    return next(new ValidationError('from must be a valid ISO 8601 datetime'));
  }

  if (to !== undefined && !isValidISO(to)) {
    return next(new ValidationError('to must be a valid ISO 8601 datetime'));
  }

  if (from && to && new Date(to) <= new Date(from)) {
    return next(new ValidationError('to must be after from'));
  }

  // Pagination
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  req.query.page  = page;
  req.query.limit = limit;

  next();
};

// ─── PATCH /bookings/:id/cancel ───────────────────────────────
const validateCancelBooking = (req, res, next) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return next(new ValidationError('Booking id must be a valid UUID'));
  next();
};

// ─── PATCH /bookings/:id/reschedule ──────────────────────────
const validateRescheduleBooking = (req, res, next) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return next(new ValidationError('Booking id must be a valid UUID'));

  const { start_time, end_time } = req.body;

  if (!start_time)            return next(new ValidationError('start_time is required'));
  if (!isValidISO(start_time)) return next(new ValidationError('start_time must be a valid ISO 8601 datetime'));

  if (!end_time)              return next(new ValidationError('end_time is required'));
  if (!isValidISO(end_time))  return next(new ValidationError('end_time must be a valid ISO 8601 datetime'));

  const start = new Date(start_time);
  const end   = new Date(end_time);
  const now   = new Date();

  // Edge case 1: end before start
  if (end <= start) {
    return next(new ValidationError('end_time must be after start_time'));
  }

  // Edge case 2: new start must be in the future
  if (start <= now) {
    return next(new ValidationError('Rescheduled start_time must be in the future'));
  }

  next();
};

module.exports = {
  validateCreateBooking,
  validateGetBookings,
  validateCancelBooking,
  validateRescheduleBooking,
};
