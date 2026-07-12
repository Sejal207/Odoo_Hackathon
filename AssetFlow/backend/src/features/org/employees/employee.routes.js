// ============================================================
// employee.routes.js
// RBAC:
//   GET  /           → ADMIN only
//   PATCH /:id       → ADMIN only (name / department)
//   PATCH /:id/role  → ADMIN only
//   PATCH /:id/status → ADMIN only
// ============================================================

const express  = require('express');
const router   = express.Router();

const authenticate = require('../../../middlewares/auth.middleware');
const authorize    = require('../../../middlewares/rbac.middleware');
const { ROLES }    = require('../../../utils/constants');

const employeeController = require('./employee.controller');
const {
  validateUpdateEmployee,
  validateUpdateRole,
  validateUpdateStatus,
} = require('./employee.validation');

router.use(authenticate);

// GET /api/org/employees
router.get('/',
  authorize(ROLES.ADMIN),
  employeeController.getEmployees
);

// PATCH /api/org/employees/:id  — profile update (name, department)
router.patch('/:id',
  authorize(ROLES.ADMIN),
  validateUpdateEmployee,
  employeeController.updateEmployee
);

// PATCH /api/org/employees/:id/role  — role change (dedicated endpoint)
router.patch('/:id/role',
  authorize(ROLES.ADMIN),
  validateUpdateRole,
  employeeController.updateRole
);

// PATCH /api/org/employees/:id/status  — activate / deactivate
router.patch('/:id/status',
  authorize(ROLES.ADMIN),
  validateUpdateStatus,
  employeeController.updateStatus
);

module.exports = router;
