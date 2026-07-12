// ============================================================
// booking.routes.js
// RBAC:
//   POST   / → any authenticated user can book
//   GET    / → any authenticated user (employees see own; admins see all)
//   PATCH  /:id/cancel     → any authenticated user (ownership enforced in service)
//   PATCH  /:id/reschedule → any authenticated user (ownership enforced in service)
// ============================================================

const express  = require('express');
const router   = express.Router();

const authenticate = require('../../middlewares/auth.middleware');
const {
  validateCreateBooking,
  validateGetBookings,
  validateCancelBooking,
  validateRescheduleBooking,
} = require('./booking.validation');
const bookingController = require('./booking.controller');

router.use(authenticate);

// POST /api/bookings
router.post('/',
  validateCreateBooking,
  bookingController.createBooking
);

// GET /api/bookings?assetId=&from=&to=&page=&limit=
router.get('/',
  validateGetBookings,
  bookingController.getBookings
);

// PATCH /api/bookings/:id/cancel
router.patch('/:id/cancel',
  validateCancelBooking,
  bookingController.cancelBooking
);

// PATCH /api/bookings/:id/reschedule
router.patch('/:id/reschedule',
  validateRescheduleBooking,
  bookingController.rescheduleBooking
);

module.exports = router;
