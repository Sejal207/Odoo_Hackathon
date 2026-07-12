const successResponse = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data
  });
};

const errorResponse = (res, error) => {
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred.'
    }
  });
};

module.exports = {
  successResponse,
  errorResponse
};
