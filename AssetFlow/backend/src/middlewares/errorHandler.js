const { errorResponse } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // If it's already an AppError, we have the code and statusCode
  if (err.statusCode && err.code) {
    return errorResponse(res, err);
  }

  let statusCode = err.statusCode || 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred.';

  // Postgres unique constraint violation
  if (err.code === '23505') {
    statusCode = 409;
    code = 'CONFLICT';
    message = 'Duplicate field value entered';
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;
