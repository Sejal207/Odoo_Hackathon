// ============================================================
// booking.controller.js
// Thin controller — delegates everything to booking.service.js
// ============================================================

const bookingService = require('./booking.service');
const { successResponse } = require('../../utils/response');

// POST /api/bookings
const createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.createBooking(req.user.id, req.body);
    successResponse(res, booking, 201);
  } catch (err) { next(err); }
};

// GET /api/bookings
const getBookings = async (req, res, next) => {
  try {
    const result = await bookingService.getBookings(
      req.user.id,
      req.user.role,
      req.query           // service does defensive parsing internally
    );
    successResponse(res, result);
  } catch (err) { next(err); }
};

// PATCH /api/bookings/:id/cancel
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.cancelBooking(
      req.params.id,
      req.user.id,
      req.user.role
    );
    successResponse(res, booking);
  } catch (err) { next(err); }
};

// PATCH /api/bookings/:id/reschedule
const rescheduleBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.rescheduleBooking(
      req.params.id,
      req.user.id,
      req.user.role,
      req.body
    );
    successResponse(res, booking);
  } catch (err) { next(err); }
};

module.exports = { createBooking, getBookings, cancelBooking, rescheduleBooking };
