const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 导入中间件
const errorHandler = require('./middleware/errorHandler');
const { startLogCleanupSchedule } = require('./middleware/adminLogger');
const { 
  sanitizeRequestBody, 
  RateLimiter, 
  securityHeaders 
} = require('./middleware/security');

// 导入路由
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const presetRoutes = require('./routes/presets');
const paymentRoutes = require('./routes/payment');
const { router: configRoutes } = require('./routes/config');
const adminRoutes = require('./routes/admin');
const sensitiveWordRoutes = require('./routes/sensitiveWord');


const app = express();
const PORT = process.env.PORT || 3000;

// 创建速率限制器
const apiLimiter = new RateLimiter({
  windowMs: 60000,      // 1分钟
  maxRequests: 100      // 最多100个请求
});

const authLimiter = new RateLimiter({
  windowMs: 60000,      // 1分钟（开发环境）
  maxRequests: 30       // 最多30次请求（开发环境）
  // 生产环境建议: windowMs: 15 * 60000, maxRequests: 5
});

// 安全中间件（应用到所有路由）
app.use(securityHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 清理用户输入
app.use(sanitizeRequestBody);

app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:8000').split(','),
  credentials: true
}));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由（应用速率限制）
app.use('/api/auth', authLimiter.middleware(), authRoutes);
app.use('/api/orders', apiLimiter.middleware(), orderRoutes);
app.use('/api/users', apiLimiter.middleware(), userRoutes);
app.use('/api/presets', presetRoutes);
app.use('/api/payment', apiLimiter.middleware(), paymentRoutes);
app.use('/api/config', configRoutes);
app.use('/api/admin', apiLimiter.middleware(), adminRoutes);
app.use('/api/sensitive-word', sensitiveWordRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '请求的资源不存在',
    path: req.path
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
  console.log(`✓ 服务器运行在 http://localhost:${PORT}`);
  console.log(`✓ 环境: ${process.env.NODE_ENV || 'development'}`);
  
  // 启动日志自动清理任务（保留90天）
  startLogCleanupSchedule(30);
});

module.exports = app;
