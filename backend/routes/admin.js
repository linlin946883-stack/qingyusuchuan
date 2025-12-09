const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { logAdminAccess, cleanOldLogs } = require('../middleware/adminLogger');

// 应用日志中间件到所有管理员路由
router.use(logAdminAccess);

// 简单的管理员验证中间件（后续可以改为基于角色的权限）
const adminAuth = async (req, res, next) => {
  try {
    // 先进行用户认证
    await authenticate(req, res, () => {});
    
    // 检查是否是管理员
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.execute(
        'SELECT role FROM users WHERE id = ?',
        [req.user.userId]
      );
      
      if (users.length === 0 || users[0].role !== 'admin') {
        return res.status(403).json({
          code: 403,
          message: '权限不足，仅管理员可访问'
        });
      }
      
      next();
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(401).json({
      code: 401,
      message: '认证失败'
    });
  }
};

// ==================== 数据统计看板 ====================

// 获取总览统计
router.get('/dashboard/stats', adminAuth, async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // 用户统计
      const [userStats] = await connection.execute(
        'SELECT COUNT(*) as total, SUM(balance) as totalBalance FROM users'
      );
      
      // 订单统计
      const [orderStats] = await connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(price) as totalRevenue,
          SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END) as completedRevenue
        FROM orders
      `);
      
      // 今日订单
      const [todayOrders] = await connection.execute(`
        SELECT COUNT(*) as count, SUM(price) as revenue
        FROM orders 
        WHERE DATE(created_at) = CURDATE()
      `);
      
      // 订单类型分布
      const [typeStats] = await connection.execute(`
        SELECT 
          type,
          COUNT(*) as count,
          SUM(price) as revenue
        FROM orders
        GROUP BY type
      `);
      
      res.json({
        code: 0,
        data: {
          users: {
            total: userStats[0].total,
            totalBalance: parseFloat(userStats[0].totalBalance || 0)
          },
          orders: {
            total: orderStats[0].total,
            pending: orderStats[0].pending,
            processing: orderStats[0].processing,
            completed: orderStats[0].completed,
            failed: orderStats[0].failed,
            totalRevenue: parseFloat(orderStats[0].totalRevenue || 0),
            completedRevenue: parseFloat(orderStats[0].completedRevenue || 0)
          },
          today: {
            orders: todayOrders[0].count,
            revenue: parseFloat(todayOrders[0].revenue || 0)
          },
          typeDistribution: typeStats
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// ==================== 订单管理 ====================

// 获取所有订单（分页）
router.get('/orders', adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status, type, userId } = req.query;
    const offset = (page - 1) * limit;
    
    const connection = await pool.getConnection();
    
    try {
      let whereClause = [];
      let params = [];
      
      if (status) {
        whereClause.push('o.status = ?');
        params.push(status);
      }
      
      if (type) {
        whereClause.push('o.type = ?');
        params.push(type);
      }
      
      if (userId) {
        whereClause.push('o.user_id = ?');
        params.push(parseInt(userId));
      }
      
      const where = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
      
      // 获取订单列表（带用户信息）
      const ordersQuery = `
        SELECT 
          o.*,
          u.phone as user_phone,
          u.nickname as user_nickname
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ${where}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const queryParams = [...params, limit, offset];
      console.log('订单查询参数:', { queryParams, limit, offset, page, where, sql: ordersQuery.substring(0, 200) });
      const [orders] = await connection.query(ordersQuery, queryParams);
      
      // 获取总数
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM orders o
        ${where}
      `;
      
      const [countResult] = await connection.query(countQuery, params);
      
      res.json({
        code: 0,
        data: {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 获取单个订单详情（管理员）
router.get('/orders/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    try {
      const [orders] = await connection.query(
        `SELECT 
          o.*,
          u.phone as user_phone,
          u.nickname as user_nickname
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = ?`,
        [id]
      );
      
      if (orders.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '订单不存在'
        });
      }
      
      res.json({
        code: 0,
        data: orders[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 更新订单状态（管理员手动操作）
router.patch('/orders/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remark, virtual_number } = req.body;
    
    const connection = await pool.getConnection();
    
    try {
      const updates = [];
      const params = [];
      
      if (status) {
        updates.push('status = ?');
        params.push(status);
      }
      
      if (remark !== undefined) {
        updates.push('remark = ?');
        params.push(remark);
      }
      
      if (virtual_number !== undefined) {
        updates.push('virtual_number = ?');
        params.push(virtual_number);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({
          code: 400,
          message: '没有要更新的字段'
        });
      }
      
      updates.push('updated_at = NOW()');
      params.push(id);
      
      await connection.query(
        `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      
      res.json({
        code: 0,
        message: '订单更新成功'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 删除订单（需要二次确认，建议改为软删除）
router.delete('/orders/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { confirm } = req.body; // 需要前端传递 confirm: true
    
    // 安全检查：必须明确确认
    if (confirm !== true) {
      return res.status(400).json({
        code: 400,
        message: '删除操作需要确认，请传递 confirm: true'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 1. 先检查订单是否存在
      const [orders] = await connection.query(
        'SELECT id, type, status, user_id, price FROM orders WHERE id = ?', 
        [id]
      );
      
      if (orders.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '订单不存在'
        });
      }
      
      const order = orders[0];
      
      // 2. 检查订单状态，防止删除处理中的订单
      if (order.status === 'processing') {
        return res.status(400).json({
          code: 400,
          message: '无法删除处理中的订单，请先将状态改为已完成或失败'
        });
      }
      
      // 3. 记录删除操作到日志（便于审计）
      await connection.execute(
        `INSERT INTO admin_logs (user_id, user_phone, user_nickname, endpoint, method, status_code, response_code, ip_address, metadata)
         SELECT ?, u.phone, u.nickname, '/admin/orders/:id', 'DELETE', 200, 0, ?, ?
         FROM users u WHERE u.id = ?`,
        [
          req.user.userId, 
          req.ip || req.connection.remoteAddress,
          JSON.stringify({ deleted_order: order }),
          req.user.userId
        ]
      );
      
      // 4. 执行删除
      await connection.query('DELETE FROM orders WHERE id = ?', [id]);
      
      res.json({
        code: 0,
        message: '订单删除成功',
        data: {
          deleted_order_id: id,
          deleted_order_type: order.type
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// ==================== 用户管理 ====================

// 获取所有用户（分页）
router.get('/users', adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { search } = req.query;
    const offset = (page - 1) * limit;
    
    const connection = await pool.getConnection();
    
    try {
      let whereClause = '';
      let params = [];
      
      if (search) {
        whereClause = 'WHERE phone LIKE ? OR nickname LIKE ?';
        params.push(`%${search}%`, `%${search}%`);
      }
      
      const [users] = await connection.query(`
        SELECT 
          id, openid, phone, nickname, avatar, balance, role, is_super_admin, created_at, updated_at
        FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);
      
      const [countResult] = await connection.query(`
        SELECT COUNT(*) as total FROM users ${whereClause}
      `, params);
      
      res.json({
        code: 0,
        data: {
          users,
          pagination: {
            page: page,
            limit: limit,
            total: countResult[0].total
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 更新用户余额
router.patch('/users/:id/balance', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, operation, remark } = req.body; // operation: 'add' or 'set'
    
    if (!amount || !operation) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      if (operation === 'add') {
        // 增加余额
        await connection.execute(
          'UPDATE users SET balance = balance + ? WHERE id = ?',
          [amount, id]
        );
      } else if (operation === 'set') {
        // 设置余额
        await connection.execute(
          'UPDATE users SET balance = ? WHERE id = ?',
          [amount, id]
        );
      } else {
        await connection.rollback();
        return res.status(400).json({
          code: 400,
          message: '无效的操作类型'
        });
      }
      
      // 记录到支付表
      await connection.execute(
        `INSERT INTO payments (user_id, type, amount, status, remark) 
         VALUES (?, 'admin_adjust', ?, 'completed', ?)`,
        [id, amount, remark || '管理员调整余额']
      );
      
      await connection.commit();
      
      res.json({
        code: 0,
        message: '余额更新成功'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 更新用户角色
router.patch('/users/:id/role', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const currentUserId = req.user.userId;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        code: 400,
        message: '无效的角色'
      });
    }
    
    // 防止修改自己的权限
    if (parseInt(id) === currentUserId) {
      return res.status(403).json({
        code: 403,
        message: '不能修改自己的权限'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 检查目标用户是否是超级管理员
      const [users] = await connection.query(
        'SELECT is_super_admin FROM users WHERE id = ?',
        [id]
      );
      
      if (users.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在'
        });
      }
      
      if (users[0].is_super_admin === 1) {
        return res.status(403).json({
          code: 403,
          message: '不能修改超级管理员的权限'
        });
      }
      
      await connection.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, id]
      );
      
      res.json({
        code: 0,
        message: '角色更新成功'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// ==================== 访问日志管理 ====================

// 获取管理员访问日志
router.get('/logs/access', adminAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, user_id, days = 7 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const connection = await pool.getConnection();

    try {
      let whereClause = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';
      let params = [parseInt(days)];

      if (user_id) {
        whereClause += ' AND user_id = ?';
        params.push(parseInt(user_id));
      }

      // 获取日志列表
      const [logs] = await connection.query(
        `SELECT 
          id, user_id, user_phone, user_nickname, endpoint, method, status_code, 
          ip_address, response_code, created_at
        FROM admin_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      );

      // 获取总数
      const [countResult] = await connection.query(
        `SELECT COUNT(*) as total FROM admin_logs ${whereClause}`,
        params
      );

      res.json({
        code: 0,
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 获取管理员操作统计
router.get('/logs/stats', adminAuth, async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      // 统计各管理员的操作数
      const [adminStats] = await connection.query(`
        SELECT 
          user_id, user_phone, user_nickname,
          COUNT(*) as access_count,
          COUNT(DISTINCT DATE(created_at)) as access_days,
          MAX(created_at) as last_access
        FROM admin_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY user_id, user_phone, user_nickname
        ORDER BY access_count DESC
      `);

      // 统计各端点的访问数
      const [endpointStats] = await connection.query(`
        SELECT 
          endpoint,
          method,
          COUNT(*) as access_count,
          COUNT(DISTINCT user_id) as user_count
        FROM admin_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY endpoint, method
        ORDER BY access_count DESC
        LIMIT 20
      `);

      res.json({
        code: 0,
        data: {
          adminStats,
          endpointStats
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 手动清理旧日志
router.delete('/logs/cleanup', adminAuth, async (req, res, next) => {
  try {
    const { days = 90 } = req.body;
    
    if (days < 7) {
      return res.status(400).json({
        code: 400,
        message: '保留天数不能少于7天'
      });
    }
    
    const deletedCount = await cleanOldLogs(parseInt(days));
    
    res.json({
      code: 0,
      message: '日志清理成功',
      data: {
        deletedCount,
        daysKept: parseInt(days)
      }
    });
  } catch (error) {
    next(error);
  }
});

// ==================== 价格配置管理 ====================

// 更新价格配置（需要重启服务器生效，或者使用动态配置）
router.get('/config/prices', adminAuth, async (req, res, next) => {
  const { ORDER_PRICES } = require('./config');
  res.json({
    code: 0,
    data: ORDER_PRICES
  });
});

module.exports = router;
