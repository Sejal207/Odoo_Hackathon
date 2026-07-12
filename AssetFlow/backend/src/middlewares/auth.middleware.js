const { verifyToken } = require('../config/jwt');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { query } = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid JWT');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Invalid JWT');
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      throw new UnauthorizedError('Expired JWT or Invalid JWT');
    }

    const { rows } = await query('SELECT id, email, role, status FROM users WHERE id = $1', [decoded.id]);
    const user = rows[0];

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status === 'inactive') {
      throw new ForbiddenError('Inactive account or Deleted account');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;
