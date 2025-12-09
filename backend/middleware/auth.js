const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'qingyusuchuan_secret_key_2024';
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '30d';

/**
 * 生成 JWT Token
 * @param {object} payload - token 载荷
 * @returns {string} token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

/**
 * 验证和解析 Token
 * @param {string} token - token 字符串
 * @returns {object|null} 解析后的数据或 null
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Token 认证中间件
 * 验证请求头中的 Authorization token
 * 将解析的用户信息保存到 req.user
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证令牌'
    });
  }

  // 处理 "Bearer <token>" 格式
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({
      code: 401,
      message: '令牌无效或已过期'
    });
  }

  // 将解析的用户信息保存到请求对象
  req.user = decoded;
  next();
}

/**
 * 可选的 Token 认证中间件
 * 如果提供了 token 则验证，否则继续
 */
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    const decoded = verifyToken(token);
    
    if (decoded) {
      req.user = decoded;
    }
  }
  
  next();
}

/**
 * 管理员权限验证中间件
 * 必须在 authenticate 之后使用
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      code: 401,
      message: '未认证'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      code: 403,
      message: '权限不足，仅管理员可访问'
    });
  }

  next();
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuthenticate,
  requireAuth: authenticate, // 别名
  requireAdmin
};
