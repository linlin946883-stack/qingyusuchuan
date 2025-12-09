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
 * 简单的速率限制（内存版）
 * 生产环境建议使用 Redis
 */
class RateLimiter {
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
  constructor() {
    this.tokens = new Map();
    
    // 定期清理过期 token（30分钟）
    setInterval(() => {
      const now = Date.now();
      for (const [token, timestamp] of this.tokens.entries()) {
        if (now - timestamp > 30 * 60 * 1000) {
          this.tokens.delete(token);
        }
      }
    }, 5 * 60 * 1000);
  }
  
  generateToken() {
    const token = require('crypto').randomBytes(32).toString('hex');
    this.tokens.set(token, Date.now());
    return token;
  }
  
  validateToken(token) {
    return this.tokens.has(token);
  }
  
  middleware() {
    return (req, res, next) => {
      // GET、HEAD、OPTIONS 请求不需要 CSRF token
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }
      
      // 从请求头或请求体获取 token
      const token = req.headers['x-csrf-token'] || req.body._csrf;
      
      if (!token || !this.validateToken(token)) {
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
    return (req, res) => {
      const token = this.generateToken();
      res.json({
        code: 0,
        data: { csrfToken: token }
      });
    };
  }
}

module.exports = {
  escapeHtml,
  sanitizeInput,
  sanitizeObject,
  sanitizeRequestBody,
  RateLimiter,
  securityHeaders,
  validateNoSqlInjection,
  CSRFProtection
};
