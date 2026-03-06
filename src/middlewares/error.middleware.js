import { errorResponse } from '../utils/apiResponse.js';

export const notFound = (req, res) => {
  return errorResponse({
    res,
    statusCode: 404,
    message: `Không tìm thấy đường dẫn: ${req.originalUrl}`
  });
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  if (res.headersSent) {
    return next(err);
  }

  return errorResponse({
    res,
    statusCode,
    message: err.message || 'Lỗi hệ thống',
    errors:
      process.env.NODE_ENV === 'production'
        ? null
        : {
            stack: err.stack
          }
  });
};
