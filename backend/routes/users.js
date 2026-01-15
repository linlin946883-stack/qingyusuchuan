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

// 获取指定用户信息（需要认证，只能查看自己或管理员查看所有）
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user.userId;
    const userRole = req.user.role || 'user';

    // 权限验证：只能查看自己的信息，除非是管理员
    if (userRole !== 'admin' && parseInt(id) !== authenticatedUserId) {
      return res.status(403).json({
        code: 403,
        message: '您没有权限查看该用户信息'
      });
    }

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

// 更新用户余额（需要认证）- 仅管理员可操作
router.patch('/:id/balance', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user.userId;
    const userRole = req.user.role || 'user';
    const { amount } = req.body;

    // 权限验证：只有管理员可以修改用户余额
    if (userRole !== 'admin') {
      return res.status(403).json({
        code: 403,
        message: '您没有权限修改用户余额，请联系管理员'
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
