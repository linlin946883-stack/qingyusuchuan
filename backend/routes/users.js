const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

// 获取用户信息（需要认证）
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT id, openid, phone, nickname, avatar, balance, created_at FROM users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在'
        });
      }

      res.json({
        code: 0,
        data: rows[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 获取用户信息（不需要认证，保留用于后向兼容）
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT id, openid, phone, nickname, avatar, balance, created_at FROM users WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在'
        });
      }

      res.json({
        code: 0,
        data: rows[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 更新用户余额（需要认证）
router.patch('/balance', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    if (amount === undefined) {
      return res.status(400).json({
        code: 400,
        message: '金额不能为空'
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE users SET balance = balance + ?, updated_at = NOW() WHERE id = ?',
        [amount, userId]
      );

      const [rows] = await connection.execute(
        'SELECT balance FROM users WHERE id = ?',
        [userId]
      );

      res.json({
        code: 0,
        message: '余额更新成功',
        data: {
          balance: rows[0].balance
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 更新用户余额（需要认证）- 兼容原有路由
router.patch('/:id/balance', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user.userId;
    const { amount } = req.body;

    // 验证用户权限，只能修改自己的余额
    if (parseInt(id) !== authenticatedUserId) {
      return res.status(403).json({
        code: 403,
        message: '您没有权限修改该用户的余额'
      });
    }

    if (amount === undefined) {
      return res.status(400).json({
        code: 400,
        message: '金额不能为空'
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE users SET balance = balance + ?, updated_at = NOW() WHERE id = ?',
        [amount, id]
      );

      const [rows] = await connection.execute(
        'SELECT balance FROM users WHERE id = ?',
        [id]
      );

      res.json({
        code: 0,
        message: '余额更新成功',
        data: {
          balance: rows[0].balance
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
