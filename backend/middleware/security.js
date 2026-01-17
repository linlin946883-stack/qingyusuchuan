/**
 * 安全中间件
 * 提供 XSS、SQL 注入、CSRF 等安全防护
 */

/**
 * XSS 防护 - HTML 实体转义
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };
  
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * 清理用户输入 - 移除潜在危险字符
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // 移除控制字符
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/**
 * 验证和清理对象中的所有字符串字段
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * 请求体清理中间件
 */
function sanitizeRequestBody(req, res, next) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * 速率限制（内存版）
 * 适用于开发环境和单机部署
 */
class MemoryRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1分钟
    this.maxRequests = options.maxRequests || 100;
    this.requests = new Map();
    
    // 定期清理过期记录
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.requests.entries()) {
        if (now - data.firstRequest > this.windowMs) {
          this.requests.delete(key);
        }
      }
    }, this.windowMs);
  }
  
  middleware() {
    return (req, res, next) => {
      const identifier = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      
      if (!this.requests.has(identifier)) {
        this.requests.set(identifier, {
          count: 1,
          firstRequest: now
        });
        return next();
      }
      
      const data = this.requests.get(identifier);
      
      // 如果超过时间窗口，重置计数
      if (now - data.firstRequest > this.windowMs) {
        this.requests.set(identifier, {
          count: 1,
          firstRequest: now
        });
        return next();
      }
      
      // 增加计数
      data.count++;
      
      // 检查是否超过限制
      if (data.count > this.maxRequests) {
        return res.status(429).json({
          code: 429,
          message: '请求过于频繁，请稍后再试'
        });
      }
      
      next();
    };
  }
}

/**
 * 速率限制（Redis 版）
 * 适用于生产环境和分布式部署
 * 需要安装: npm install redis
 */
class RedisRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1分钟
    this.maxRequests = options.maxRequests || 100;
    this.redisClient = options.redisClient;
    this.prefix = options.prefix || 'rate_limit:';
    
    if (!this.redisClient) {
      throw new Error('RedisRateLimiter 需要提供 redisClient 实例');
    }
  }
  
  middleware() {
    return async (req, res, next) => {
      const identifier = req.ip || req.connection.remoteAddress;
      const key = `${this.prefix}${identifier}`;
      const now = Date.now();
      const windowStart = now - this.windowMs;
      
      try {
        // 使用 Redis Sorted Set 存储请求时间戳
        // 1. 移除过期的记录
        await this.redisClient.zRemRangeByScore(key, 0, windowStart);
        
        // 2. 获取当前窗口内的请求数
        const count = await this.redisClient.zCard(key);
        
        if (count >= this.maxRequests) {
          return res.status(429).json({
            code: 429,
            message: '请求过于频繁，请稍后再试'
          });
        }
        
        // 3. 添加当前请求
        await this.redisClient.zAdd(key, {
          score: now,
          value: `${now}_${Math.random()}`
        });
        
        // 4. 设置 key 过期时间（防止内存泄漏）
        await this.redisClient.expire(key, Math.ceil(this.windowMs / 1000));
        
        next();
      } catch (error) {
        console.error('Redis 速率限制失败:', error);
        // Redis 失败时降级到允许请求（避免服务不可用）
        next();
      }
    };
  }
}

/**
 * 速率限制器工厂函数
 * 根据环境变量自动选择内存或 Redis 实现
 */
function createRateLimiter(options = {}) {
  const useRedis = process.env.USE_REDIS_RATE_LIMIT === 'true';
  
  if (useRedis && options.redisClient) {
    console.log('✓ 使用 Redis 速率限制');
    return new RedisRateLimiter(options);
  } else {
    console.log('✓ 使用内存速率限制（开发环境）');
    return new MemoryRateLimiter(options);
  }
}

// 向后兼容的别名
const RateLimiter = MemoryRateLimiter;

/**
 * 安全响应头中间件
 */
function securityHeaders(req, res, next) {
  // 防止 XSS 攻击
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );
  
  // 严格传输安全（如果使用 HTTPS）
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}

/**
 * SQL 注入防护提示
 * 注意：主要防护应该通过参数化查询（已使用 connection.execute）
 */
function validateNoSqlInjection(input) {
  if (typeof input !== 'string') return true;
  
  // 检测常见 SQL 注入模式
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/i,
    /('|(\\')|(\\")|(\\\\))/
  ];
  
  return !sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * CSRF Token 生成和验证
 */
class CSRFProtection {
  constructor(options = {}) {
    this.tokens = new Map();
    this.redisClient = options.redisClient || null;
    this.tokenExpiry = options.tokenExpiry || 30 * 60 * 1000; // 30分钟
    this.redisPrefix = 'csrf:';
    
    // 只在使用内存存储时定期清理过期 token
    if (!this.redisClient) {
      setInterval(() => {
        const now = Date.now();
        for (const [token, timestamp] of this.tokens.entries()) {
          if (now - timestamp > this.tokenExpiry) {
            this.tokens.delete(token);
          }
        }
      }, 5 * 60 * 1000);
      
      console.log('⚠ CSRF 使用内存存储（不适合多实例部署）');
    } else {
      console.log('✓ CSRF 使用 Redis 存储');
    }
  }
  
  generateToken() {
    const token = require('crypto').randomBytes(32).toString('hex');
    return token;
  }
  
  async storeToken(token) {
    if (this.redisClient) {
      try {
        // 使用 Redis 存储，设置过期时间
        await this.redisClient.set(
          `${this.redisPrefix}${token}`,
          Date.now().toString(),
          { EX: Math.floor(this.tokenExpiry / 1000) }
        );
        return true;
      } catch (error) {
        console.error('Redis 存储 CSRF token 失败，降级到内存:', error.message);
        this.tokens.set(token, Date.now());
        return true;
      }
    } else {
      this.tokens.set(token, Date.now());
      return true;
    }
  }
  
  async validateToken(token) {
    if (!token) return false;
    
    if (this.redisClient) {
      try {
        const exists = await this.redisClient.exists(`${this.redisPrefix}${token}`);
        return exists === 1;
      } catch (error) {
        console.error('Redis 验证 CSRF token 失败，降级到内存:', error.message);
        return this.tokens.has(token);
      }
    } else {
      return this.tokens.has(token);
    }
  }
  
  middleware() {
    return async (req, res, next) => {
      // GET、HEAD、OPTIONS 请求不需要 CSRF token
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }
      
      // 从请求头或请求体获取 token
      const token = req.headers['x-csrf-token'] || req.body._csrf;
      
      if (!token) {
        console.warn(`CSRF验证失败 [${req.method} ${req.path}]: 缺少token`);
        return res.status(403).json({
          code: 403,
          message: 'Invalid CSRF token'
        });
      }
      
      const isValid = await this.validateToken(token);
      
      if (!isValid) {
        console.warn(`CSRF验证失败 [${req.method} ${req.path}]: token无效或已过期`);
        console.warn(`Token: ${token.substring(0, 16)}...`);
        return res.status(403).json({
          code: 403,
          message: 'Invalid CSRF token'
        });
      }
      
      next();
    };
  }
  
  // 生成 token 的路由
  getTokenEndpoint() {
    return async (req, res) => {
      try {
        // 检查请求头中是否已有 token
        const existingToken = req.headers['x-csrf-token'];
        
        // 如果存在 token 且仍然有效，返回现有 token
        if (existingToken) {
          const isValid = await this.validateToken(existingToken);
          if (isValid) {
            return res.json({
              code: 0,
              data: { csrfToken: existingToken }
            });
          }
        }
        
        // 否则生成新 token
        const token = this.generateToken();
        await this.storeToken(token);
        res.json({
          code: 0,
          data: { csrfToken: token }
        });
      } catch (error) {
        console.error('生成 CSRF Token 失败:', error);
        res.status(500).json({
          code: 500,
          message: '生成CSRF Token失败'
        });
      }
    };
  }
}

module.exports = {
  escapeHtml,
  sanitizeInput,
  sanitizeObject,
  sanitizeRequestBody,
  RateLimiter,  // 向后兼容
  MemoryRateLimiter,
  RedisRateLimiter,
  createRateLimiter,
  securityHeaders,
  validateNoSqlInjection,
  CSRFProtection
};
