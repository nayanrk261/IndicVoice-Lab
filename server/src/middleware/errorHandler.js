export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (error, req, res, next) => {
  const isUploadError = Boolean(
    (error.code && /^LIMIT_|^UNSUPPORTED/.test(error.code || '')) ||
      /Unsupported audio file type|exceeds the maximum supported size/i.test(error.message || '')
  );
  const statusCode = error.statusCode || (isUploadError ? 400 : 500);
  const message = error.message || 'Internal Server Error';

  const payload = {
    success: false,
    error: {
      message,
      statusCode
    }
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.error.stack = error.stack;
  }

  res.status(statusCode).json(payload);
};
