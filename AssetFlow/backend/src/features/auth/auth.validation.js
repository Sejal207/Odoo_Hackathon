const { ValidationError } = require('../../utils/errors');

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return next(new ValidationError('Empty email/password'));
  }
  if (!password || typeof password !== 'string' || password.trim() === '') {
    return next(new ValidationError('Empty email/password'));
  }
  if (!validateEmail(email)) {
    return next(new ValidationError('Invalid email format'));
  }
  next();
};

const validateForgotPassword = (req, res, next) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return next(new ValidationError('Empty email/password'));
  }
  if (!validateEmail(email)) {
    return next(new ValidationError('Invalid email format'));
  }
  next();
};

const validateCreateUser = (req, res, next) => {
  const { name, email, password, role, department_id } = req.body;
  
  if (!name || !email || !password || !role || !department_id) {
    return next(new ValidationError('Missing required fields'));
  }
  if (!validateEmail(email)) {
    return next(new ValidationError('Invalid email format'));
  }
  const validRoles = ['admin', 'asset_manager', 'department_head', 'employee'];
  if (!validRoles.includes(role)) {
    // Return 422 Invalid role as per requirements
    const error = new Error('Invalid role');
    error.statusCode = 422;
    return next(error);
  }
  next();
};

const validateUpdateRole = (req, res, next) => {
  const { role } = req.body;
  const validRoles = ['admin', 'asset_manager', 'department_head', 'employee'];
  if (!role || !validRoles.includes(role)) {
    const error = new Error('Invalid role');
    error.statusCode = 422;
    return next(error);
  }
  next();
};

module.exports = {
  validateLogin,
  validateForgotPassword,
  validateCreateUser,
  validateUpdateRole
};
