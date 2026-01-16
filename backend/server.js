const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 导入中间件
const errorHandler = require('./middleware/errorHandler');
const { 
  sanitizeRequestBody, 
  createRateLimiter, 
  securityHeaders,
  CSRFProtection 
} = require('./middleware/security');

// Redis 配置（可选）
const { createRedisClient, getRedisClient, closeRedisClient } = require('./config/redis');

// 导入路由
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const presetRoutes = require('./routes/presets');
const paymentRoutes = require('./routes/payment');
const { router: configRoutes } = require('./routes/config');
const adminRoutes = require('./routes/admin');


const app = express();
const PORT = process.env.PORT || 3000;

// 初始化 Redis（如果启用）
let redisClient = null;
(async () => {
  try {
    redisClient = await createRedisClient();
  } catch (error) {
    console.log('⚠ Redis 初始化失败，使用内存存储');
  }
})();

// 创建速率限制器（自动选择内存或 Redis）
const apiLimiter = createRateLimiter({
  windowMs: 60000,      // 1分钟
  maxRequests: 100,     // 最多100个请求
  redisClient: redisClient
});

const authLimiter = createRateLimiter({
  windowMs: 60000,      // 1分钟（开发环境）
  maxRequests: 30,      // 最多30次请求（开发环境）
  // 生产环境建议: windowMs: 15 * 60000, maxRequests: 5
  redisClient: redisClient
});

// 创建 CSRF 保护实例（传入 Redis 客户端以支持多实例部署）
const csrfProtection = new CSRFProtection({ 
  redisClient: redisClient,
  tokenExpiry: 30 * 60 * 1000 // 30分钟
});

// 安全中间件（应用到所有路由）
app.use(securityHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 清理用户输入
app.use(sanitizeRequestBody);

// CORS 配置 - 动态允许来源
const allowedOrigins = [
  'http://localhost:8000',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://i.lov2u.cn',
  'https://min.lov2u.cn',
  'https://lov2u.cn',
  'http://i.lov2u.cn',
  'http://min.lov2u.cn',
  'http://lov2u.cn'
];

app.use(cors({
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（如移动应用、Postman等）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`⚠ CORS阻止来自未授权来源的请求: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CSRF Token 获取端点（需要在应用 CSRF 中间件之前）
app.get('/api/csrf-token', csrfProtection.getTokenEndpoint());

// 条件CSRF中间件 - 排除登录路由
const conditionalCSRF = (req, res, next) => {
  // 排除管理员登录路由
  if (req.path === '/login' && req.method === 'POST') {
    return next();
  }
  return csrfProtection.middleware()(req, res, next);
};

// API 路由（应用速率限制和 CSRF 保护）
// 注意：authRoutes 不需要 CSRF（登录/注册使用独立验证机制）
app.use('/api/auth', authLimiter.middleware(), authRoutes);
app.use('/api/admin', apiLimiter.middleware(), conditionalCSRF, adminRoutes);
app.use('/api/orders', apiLimiter.middleware(), csrfProtection.middleware(), orderRoutes);
app.use('/api/users', apiLimiter.middleware(), csrfProtection.middleware(), userRoutes);
app.use('/api/presets', csrfProtection.middleware(), presetRoutes);
app.use('/api/payment', apiLimiter.middleware(), csrfProtection.middleware(), paymentRoutes);
app.use('/api/config', csrfProtection.middleware(), configRoutes);

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
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  await closeRedisClient();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n收到 SIGINT 信号，正在关闭服务器...');
  await closeRedisClient();
  process.exit(0);
});

module.exports = app;
