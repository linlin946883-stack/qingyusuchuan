const pool = require('../config/database');

// 获取客户端IP
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip ||
    'unknown'
  ).split(',')[0].trim();
}

// 不需要记录的路径（白名单）
const IGNORED_PATHS = [
  '/admin/logs/access',  // 查询日志本身不记录
  '/admin/logs/stats',   // 统计查询不记录
];

// 需要采样的高频路径（只记录部分请求）
const SAMPLED_PATHS = {
  '/admin/dashboard/stats': 0.1,  // 10% 采样率
  '/admin/orders': 0.2,           // 20% 采样率
  '/admin/users': 0.2,            // 20% 采样率
};

// 判断是否应该记录日志
function shouldLog(path) {
  // 白名单：不记录
  if (IGNORED_PATHS.includes(path)) {
    return false;
  }
  
  // 采样路径：按概率记录
  for (const [sampledPath, rate] of Object.entries(SAMPLED_PATHS)) {
    if (path.startsWith(sampledPath)) {
      return Math.random() < rate;
    }
  }
  
  // 其他路径：全部记录
  return true;
}

// 记录管理员访问日志
async function logAdminAccess(req, res, next) {
  // 保存原始 res.json 方法
  const originalJson = res.json;
  let responseCode = null;

  // 拦截 res.json 以获取响应码
  res.json = function (data) {
    responseCode = data?.code || res.statusCode;
    return originalJson.call(this, data);
  };

  // 在响应完成后记录日志
  res.on('finish', async () => {
    try {
      // 只记录成功认证的管理员请求
      if (!req.user) {
        return;
      }
      
      // 判断是否应该记录
      if (!shouldLog(req.path)) {
        return;
      }

      const connection = await pool.getConnection();
      
      try {
        // 获取用户信息
        const [users] = await connection.query(
          'SELECT phone, nickname FROM users WHERE id = ?',
          [req.user.userId]
        );

        const user = users[0] || {};
        const ip = getClientIp(req);

        // 记录日志
        await connection.query(
          `INSERT INTO admin_logs 
           (user_id, user_phone, user_nickname, endpoint, method, status_code, ip_address, user_agent, response_code) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.userId,
            user.phone || '',
            user.nickname || '',
            req.path,
            req.method,
            res.statusCode,
            ip,
            req.headers['user-agent'] || '',
            responseCode
          ]
        );
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('记录管理员日志失败:', error);
      // 不影响正常请求
    }
  });

  next();
}

// 清理旧日志（保留最近 N 天）
async function cleanOldLogs(daysToKeep = 30) {
  try {
    const connection = await pool.getConnection();
    
    try {
      const [result] = await connection.query(
        'DELETE FROM admin_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [daysToKeep]
      );
      
      console.log(`清理了 ${result.affectedRows} 条过期日志（保留 ${daysToKeep} 天）`);
      return result.affectedRows;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('清理旧日志失败:', error);
    throw error;
  }
}

// 启动定期清理任务（每天凌晨3点执行）
function startLogCleanupSchedule(daysToKeep = 90) {
  // 计算下次清理时间（明天凌晨3点）
  function getNextCleanupTime() {
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(3, 0, 0, 0);
    return next.getTime() - now.getTime();
  }
  
  function scheduleNextCleanup() {
    const delay = getNextCleanupTime();
    setTimeout(async () => {
      try {
        await cleanOldLogs(daysToKeep);
      } catch (error) {
        console.error('定时清理日志失败:', error);
      }
      // 调度下一次清理
      scheduleNextCleanup();
    }, delay);
  }
  
  scheduleNextCleanup();
  console.log(`日志清理任务已启动，将保留最近 ${daysToKeep} 天的日志`);
}

module.exports = { 
  logAdminAccess, 
  getClientIp, 
  cleanOldLogs,
  startLogCleanupSchedule 
};
