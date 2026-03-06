export const successResponse = ({
  res,
  message = 'Thành công',
  data = null,
  meta = null,
  statusCode = 200
}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta
  });
};

export const errorResponse = ({
  res,
  message = 'Có lỗi xảy ra',
  errors = null,
  statusCode = 500
}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};
