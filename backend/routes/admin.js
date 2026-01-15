const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

// 管理员认证中间件
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    console.log('❌ 管理员认证失败: 缺少 Authorization 头');
    return res.status(401).json({
      code: 401,
      message: '未授权，请先登录'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    console.log('❌ 管理员认证失败: Token格式错误');
    return res.status(401).json({
      code: 401,
      message: '未授权，请先登录'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    
    if (decoded.role !== 'admin') {
      console.log('❌ 管理员认证失败: 角色权限不足', decoded);
      return res.status(403).json({
        code: 403,
        message: '禁止访问，需要管理员权限'
      });
    }
    
    req.admin = decoded;
    next();
  } catch (err) {
    console.log('❌ 管理员认证失败: Token验证失败', err.message);
    return res.status(401).json({
      code: 401,
      message: 'Token无效或已过期'
    });
  }
};

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        message: '用户名和密码不能为空'
      });
    }
    
    const connection = await pool.getConnection();
    
    // 查询管理员账户（从users表中role为admin的记录）
    const [rows] = await connection.query(
      `SELECT id, username, password_hash, role FROM users WHERE username = ? AND role = 'admin'`,
      [username]
    );
    
    connection.release();
    
    if (rows.length === 0) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误'
      });
    }
    
    const admin = rows[0];
    
    // 验证密码
    const passwordMatch = await bcryptjs.compare(password, admin.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误'
      });
    }
    
    // 生成Token
    const token = jwt.sign(
      {
        userId: admin.id,
        username: admin.username,
        role: 'admin'
      },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '7d' }
    );
    
    res.json({
      code: 0,
      message: '登录成功',
      data: {
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role
        }
      }
    });
  } catch (err) {
    console.error('管理员登录出错:', err);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 获取仪表盘数据
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // 获取总用户数
    const [userStats] = await connection.query(
      `SELECT COUNT(*) as total_users FROM users WHERE role = 'user'`
    );
    
    // 获取今日新用户
    const [todayUsers] = await connection.query(
      `SELECT COUNT(*) as new_users FROM users WHERE role = 'user' AND DATE(created_at) = CURDATE()`
    );
    
    // 获取总订单数
    const [orderStats] = await connection.query(
      `SELECT COUNT(*) as total_orders FROM orders`
    );
    
    // 获取今日订单
    const [todayOrders] = await connection.query(
      `SELECT COUNT(*) as new_orders FROM orders WHERE DATE(created_at) = CURDATE()`
    );
    
    // 获取各类型订单分布
    const [ordersByType] = await connection.query(
      `SELECT type, COUNT(*) as count FROM orders GROUP BY type`
    );
    
    // 获取各状态订单分布
    const [ordersByStatus] = await connection.query(
      `SELECT status, COUNT(*) as count FROM orders GROUP BY status`
    );
    
    // 获取总收入
    const [revenue] = await connection.query(
      `SELECT SUM(price) as total_revenue FROM orders WHERE status = 'completed'`
    );
    
    // 获取今日收入
    const [todayRevenue] = await connection.query(
      `SELECT SUM(price) as daily_revenue FROM orders WHERE status = 'completed' AND DATE(created_at) = CURDATE()`
    );
    
    // 获取最近7天的订单趋势
    const [orderTrend] = await connection.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count FROM orders 
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`
    );
    
    connection.release();
    
    res.json({
      code: 0,
      message: '获取仪表盘数据成功',
      data: {
        summary: {
          total_users: userStats[0].total_users,
          new_users: todayUsers[0].new_users,
          total_orders: orderStats[0].total_orders,
          new_orders: todayOrders[0].new_orders,
          total_revenue: revenue[0].total_revenue ,
          daily_revenue: todayRevenue[0].daily_revenue 
        },
        order_type_distribution: ordersByType.reduce((acc, item) => {
          acc[item.type] = item.count;
          return acc;
        }, {}),
        order_status_distribution: ordersByStatus.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {}),
        order_trend: orderTrend
      }
    });
  } catch (err) {
    console.error('获取仪表盘数据出错:', err);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 获取订单列表
router.get('/orders', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, type, userId } = req.query;
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    const offset = (pageNum - 1) * pageSizeNum;
    
    const connection = await pool.getConnection();
    
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];
    
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (type && ['sms', 'call', 'human'].includes(type)) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(parseInt(userId));
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const [countResult] = await connection.execute(countQuery, params);
    const total = countResult[0].count;
    
    // 获取列表 - 使用字符串拼接而不是参数绑定
    query += ` ORDER BY created_at DESC LIMIT ${pageSizeNum} OFFSET ${offset}`;
    
    console.log('执行SQL查询:', query);
    console.log('参数:', params);
    
    const [orders] = await connection.execute(query, params);
    
    connection.release();
    
    res.json({
      code: 0,
      message: '获取订单列表成功',
      data: {
        orders,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      }
    });
  } catch (err) {
    console.error('获取订单列表出错:', err);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 获取订单详情
router.get('/orders/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    
    const [orders] = await connection.query(
      `SELECT o.*, u.phone, u.nickname FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.id = ?`,
      [id]
    );
    
    connection.release();
    
    if (orders.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '订单不存在'
      });
    }
    
    res.json({
      code: 0,
      message: '获取订单详情成功',
      data: orders[0]
    });
  } catch (err) {
    console.error('获取订单详情出错:', err);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 更新订单状态
router.put('/orders/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark } = req.body;
    
    if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '无效的订单状态'
      });
    }
    
    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      `UPDATE orders SET status = ?, remark = COALESCE(?, remark) WHERE id = ?`,
      [status, remark || null, id]
    );
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        code: 404,
        message: '订单不存在'
      });
    }
    
    res.json({
      code: 0,
      message: '订单状态更新成功'
    });
  } catch (err) {
    console.error('更新订单状态出错:', err);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 获取用户列表
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, phone, nickname } = req.query;
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    const offset = (pageNum - 1) * pageSizeNum;
    
    const connection = await pool.getConnection();
    
    let query = `
      SELECT 
        u.id, 
        u.phone, 
        u.nickname, 
        u.balance, 
        u.created_at, 
        u.updated_at,
        COALESCE((
          SELECT SUM(o.price) 
          FROM orders o 
          WHERE o.user_id = u.id AND o.status = 'completed'
        ), 0) as total_spent
      FROM users u
      WHERE u.role = "user"
    `;
    const params = [];
    
    if (phone) {
      query += ' AND u.phone LIKE ?';
      params.push(`%${phone}%`);
    }
    
    if (nickname) {
      query += ' AND u.nickname LIKE ?';
      params.push(`%${nickname}%`);
    }
    
    // 获取总数
    const countQuery = `SELECT COUNT(DISTINCT u.id) as count FROM users u WHERE u.role = "user"${phone ? ' AND u.phone LIKE ?' : ''}${nickname ? ' AND u.nickname LIKE ?' : ''}`;
    const countParams = [];
    if (phone) countParams.push(`%${phone}%`);
    if (nickname) countParams.push(`%${nickname}%`);
    const [countResult] = await connection.query(countQuery, countParams);
    const total = countResult[0].count;
    
    // 获取列表 - 使用字符串拼接
    query += ` ORDER BY u.created_at DESC LIMIT ${pageSizeNum} OFFSET ${offset}`;
    
    console.log('执行用户查询SQL:', query);
    console.log('查询参数:', params);
    
    const [users] = await connection.query(query, params);
    
    console.log('查询到的用户数量:', users.length);
    if (users.length > 0) {
      console.log('第一个用户数据示例:', users[0]);
    }
    
    connection.release();
    
    res.json({
      code: 0,
      message: '获取用户列表成功',
      data: {
        users,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      }
    });
  } catch (err) {
    console.error('获取用户列表出错:', err);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 获取用户详情
router.get('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    
    // 获取用户基本信息
    const [users] = await connection.query(
      `SELECT 
        u.id, 
        u.phone, 
        u.nickname, 
        u.balance, 
        u.created_at, 
        u.updated_at,
        COALESCE((
          SELECT SUM(o.price) 
          FROM orders o 
          WHERE o.user_id = u.id AND o.status = 'completed'
        ), 0) as total_spent
      FROM users u
      WHERE u.id = ? AND u.role = 'user'`,
      [id]
    );
    
    if (users.length === 0) {
      connection.release();
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }
    
    const user = users[0];
    
    // 获取用户订单统计
    const [orderStats] = await connection.query(
      `SELECT type, COUNT(*) as count, SUM(price) as total_spent FROM orders WHERE user_id = ? GROUP BY type`,
      [id]
    );
    
    // 获取用户最近订单
    const [recentOrders] = await connection.query(
      `SELECT id, type, status, price, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
      [id]
    );
    
    // 获取用户充值记录
    const [payments] = await connection.query(
      `SELECT amount, type, status, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
      [id]
    );
    
    connection.release();
    
    res.json({
      code: 0,
      message: '获取用户详情成功',
      data: {
        user,
        order_stats: orderStats,
        recent_orders: recentOrders,
        payment_history: payments
      }
    });
  } catch (err) {
    console.error('获取用户详情出错:', err);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 调整用户余额
router.post('/users/:id/adjust-balance', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type, remark } = req.body;
    
    if (!amount || !type || !['add', 'subtract'].includes(type)) {
      return res.status(400).json({
        code: 400,
        message: '参数错误'
      });
    }
    
    const connection = await pool.getConnection();
    
    // 获取当前余额
    const [users] = await connection.query(
      `SELECT balance FROM users WHERE id = ?`,
      [id]
    );
    
    if (users.length === 0) {
      connection.release();
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }
    
    const currentBalance = users[0].balance;
    const newBalance = type === 'add' 
      ? currentBalance + amount 
      : Math.max(0, currentBalance - amount);
    
    // 更新余额
    await connection.query(
      `UPDATE users SET balance = ? WHERE id = ?`,
      [newBalance, id]
    );
    
    // 记录到支付表（管理员操作）
    await connection.query(
      `INSERT INTO payments (user_id, amount, type, status, remark) VALUES (?, ?, ?, 'completed', ?)`,
      [id, amount, type === 'add' ? 'recharge' : 'consume', `管理员操作: ${remark || ''}`]
    );
    
    connection.release();
    
    res.json({
      code: 0,
      message: '余额调整成功',
      data: {
        previous_balance: currentBalance,
        new_balance: newBalance,
        adjustment: amount
      }
    });
  } catch (err) {
    console.error('调整余额出错:', err);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 配置管理 - 获取价格配置
router.get('/config/prices', authenticateAdmin, async (req, res) => {
  try {
    // 暂时返回硬编码的价格（可以扩展为数据库配置）
    res.json({
      code: 0,
      message: '获取价格配置成功',
      data: {
        sms: 2.99,
        call: 19.00,
        human: 29.00
      }
    });
  } catch (err) {
    console.error('获取价格配置出错:', err);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 导出数据
router.get('/export/orders', authenticateAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const connection = await pool.getConnection();
    
    let query = `SELECT o.*, u.phone, u.nickname FROM orders o 
                 LEFT JOIN users u ON o.user_id = u.id WHERE 1=1`;
    const params = [];
    
    if (startDate) {
      query += ' AND o.created_at >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND o.created_at <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY o.created_at DESC';
    
    const [orders] = await connection.query(query, params);
    
    connection.release();
    
    // 返回JSON格式，前端可下载为CSV
    res.json({
      code: 0,
      message: '导出成功',
      data: orders
    });
  } catch (err) {
    console.error('导出数据出错:', err);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

module.exports = router;
