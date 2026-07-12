// ============================================================
// employee.validation.js
// Manual validation for Employee Directory endpoints.
// ============================================================

const { ValidationError, UnprocessableEntityError } = require('../../../utils/errors');
const { ROLES } = require('../../../utils/constants');

const VALID_ROLES   = Object.values(ROLES);
const VALID_STATUSES = ['active', 'inactive'];

/**
 * PATCH /employees/:id — general profile update (name, department_id only).
 * Role changes go through PATCH /employees/:id/role exclusively.
 */
const validateUpdateEmployee = (req, res, next) => {
  const { name, department_id } = req.body;

  // Silently strip any role or password fields — role-tampering guard
  delete req.body.role;
  delete req.body.password;
  delete req.body.password_hash;

  if (!name && !department_id) {
    return next(new ValidationError('At least one field (name, department_id) must be provided'));
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      return next(new ValidationError('Name cannot be empty'));
    }
    if (name.trim().length > 150) {
      return next(new ValidationError('Name must be at most 150 characters'));
    }
    req.body.name = name.trim();
  }

  if (department_id !== undefined) {
    if (!department_id) {
      return next(new ValidationError('department_id cannot be empty'));
    }
    req.body.department_id = department_id;
  }

  next();
};

/**
 * PATCH /employees/:id/role
 */
const validateUpdateRole = (req, res, next) => {
  const { role } = req.body;

  if (!role || typeof role !== 'string') {
    return next(new ValidationError('role is required'));
  }

  if (!VALID_ROLES.includes(role)) {
    return next(new UnprocessableEntityError(
      `Invalid role '${role}'. Must be one of: ${VALID_ROLES.join(', ')}`
    ));
  }

  next();
};

/**
 * PATCH /employees/:id/status
 */
const validateUpdateStatus = (req, res, next) => {
  const { status } = req.body;

  if (!status || typeof status !== 'string') {
    return next(new ValidationError('status is required'));
  }

  if (!VALID_STATUSES.includes(status)) {
    return next(new ValidationError(
      `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(', ')}`
    ));
  }

  next();
};

module.exports = { validateUpdateEmployee, validateUpdateRole, validateUpdateStatus };
