const errorHandler = (err, req, res, next) => {
  console.error('========== 错误详情 ==========');
  console.error('Error Message:', err.message);
  console.error('Error Stack:', err.stack);
  console.error('Request Path:', req.path);
  console.error('Request Body:', req.body);
  console.error('================================');
  
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';
  
  res.status(statusCode).json({
    code: statusCode,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { error: err.stack })
  });
};

module.exports = errorHandler;
