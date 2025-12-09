const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

// 充值（需要认证）
router.post('/recharge', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        code: 400,
        message: '充值金额必须大于0'
      });
    }

    const connection = await pool.getConnection();

    try {
      // 创建支付记录
      const [result] = await connection.execute(
        `INSERT INTO payments (user_id, amount, type, status) 
         VALUES (?, ?, 'recharge', 'completed')`,
        [userId, amount]
      );

      // 更新用户余额
      await connection.execute(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [amount, userId]
      );

      res.json({
        code: 0,
        message: '充值成功',
        data: {
          payment_id: result.insertId,
          amount: amount
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
