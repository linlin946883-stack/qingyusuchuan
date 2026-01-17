const express = require('express');
const cors = require('cors');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const { 
  sanitizeRequestBody, 
  createRateLimiter, 
  securityHeaders,
  CSRFProtection 
} = require('./middleware/security');

const { createRedisClient, closeRedisClient } = require('./config/redis');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const presetRoutes = require('./routes/presets');
const paymentRoutes = require('./routes/payment');
const { router: configRoutes } = require('./routes/config');
const adminRoutes = require('./routes/admin');


const app = express();
const PORT = process.env.PORT || 3000;

let redisClient = null;
let isRedisReady = false;
let apiLimiter, authLimiter, csrfProtection;

async function initializeRedis() {
  try {
    redisClient = await createRedisClient();
    isRedisReady = !!redisClient;
    if (isRedisReady) {
      console.log('✓ Redis 已启用');
    }
  } catch (error) {
    console.log('⚠ Redis 初始化失败，使用内存存储');
    redisClient = null;
    isRedisReady = false;
  }
  
  // Redis 初始化后创建中间件
  apiLimiter = createRateLimiter({
    windowMs: 60000,
    maxRequests: 100,
    redisClient: redisClient
  });

  authLimiter = createRateLimiter({
    windowMs: 60000,
    maxRequests: 30,
    redisClient: redisClient
  });

  csrfProtection = new CSRFProtection({ 
    redisClient: redisClient || null,
    tokenExpiry: 30 * 60 * 1000
  });
}

const redisPromise = initializeRedis();

app.use(securityHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(sanitizeRequestBody);

const allowedOrigins = [
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'https://i.lov2u.cn',
  'https://min.lov2u.cn',
  'https://lov2u.cn',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  await redisPromise;
  
  // Redis 初始化后配置路由
  app.get('/api/csrf-token', csrfProtection.getTokenEndpoint());

  const conditionalCSRF = (req, res, next) => {
    if (req.path === '/login' && req.method === 'POST') {
      return next();
    }
    return csrfProtection.middleware()(req, res, next);
  };

  app.use('/api/auth', authLimiter.middleware(), authRoutes);
  app.use('/api/admin', apiLimiter.middleware(), conditionalCSRF, adminRoutes);
  app.use('/api/orders', apiLimiter.middleware(), csrfProtection.middleware(), orderRoutes);
  app.use('/api/users', apiLimiter.middleware(), csrfProtection.middleware(), userRoutes);
  app.use('/api/presets', csrfProtection.middleware(), presetRoutes);
  app.use('/api/payment', apiLimiter.middleware(), csrfProtection.middleware(), paymentRoutes);
  app.use('/api/config', csrfProtection.middleware(), configRoutes);

  app.use((req, res) => {
    res.status(404).json({
      code: 404,
      message: '请求的资源不存在',
      path: req.path
    });
  });

  app.use(errorHandler);
  
  app.listen(PORT, () => {
    console.log(`✓ 服务器运行在 http://localhost:${PORT}`);
    console.log(`✓ 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Redis: ${isRedisReady ? '已启用' : '内存模式'}`);
  });
}

startServer().catch(error => {
  console.error('✗ 服务器启动失败:', error);
  process.exit(1);
});
exports = app;
