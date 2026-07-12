const { ForbiddenError } = require('../utils/errors');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Access denied: You do not have the required permissions'));
    }
    next();
  };
};

module.exports = authorize;
