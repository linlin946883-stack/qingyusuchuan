const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const wechatPayService = require('../services/wechatPay');

/**
 * 为业务订单创建支付订单（JSAPI支付）
 * 用于微信浏览器内支付业务订单
 */
router.post('/create-order', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { order_id, amount, description } = req.body;

    // 验证参数
    if (!order_id) {
      return res.status(400).json({
        code: 400,
        message: '缺少订单ID'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        code: 400,
        message: '支付金额必须大于0'
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 查询业务订单，验证订单存在且属于当前用户
      const [orders] = await connection.execute(
        'SELECT id, user_id, price, status FROM orders WHERE id = ?',
        [order_id]
      );

      if (orders.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          code: 404,
          message: '订单不存在'
        });
      }

      const order = orders[0];

      // 验证订单所有权
      if (order.user_id !== userId) {
        await connection.rollback();
        return res.status(403).json({
          code: 403,
          message: '无权操作此订单'
        });
      }

      // 验证订单状态（只能为待支付的订单创建支付）
      if (order.status !== 'pending') {
        await connection.rollback();
        return res.status(400).json({
          code: 400,
          message: '订单状态不正确，无法支付'
        });
      }

      // 验证金额是否匹配（防止前端篡改金额）
      if (Math.abs(order.price - amount) > 0.01) {
        await connection.rollback();
        return res.status(400).json({
          code: 400,
          message: '支付金额与订单金额不符'
        });
      }

      // 生成支付订单号
      const paymentOrderId = wechatPayService.generateOrderId();
      
      // 转换为分（微信支付金额单位）
      const totalFen = Math.floor(amount * 100);

      // 获取用户openid
      const [users] = await connection.execute(
        'SELECT openid FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0 || !users[0].openid) {
        await connection.rollback();
        return res.status(400).json({
          code: 400,
          message: '用户信息不完整，请重新登录'
        });
      }

      const openid = users[0].openid;

      // 创建支付记录
      const [result] = await connection.execute(
        `INSERT INTO payments (user_id, amount, type, status, transaction_id, order_id, created_at) 
         VALUES (?, ?, 'order', 'pending', ?, ?, NOW())`,
        [userId, amount, paymentOrderId, order_id]
      );

      const paymentId = result.insertId;

      // 调用微信支付创建订单
      const payParams = await wechatPayService.createJsapiOrder({
        orderId: paymentOrderId,
        description: description || '轻羽速传服务',
        total: totalFen,
        openid: openid
      });

      await connection.commit();

      res.json({
        code: 0,
        message: '支付订单创建成功',
        data: {
          payment_id: paymentId,
          order_id: paymentOrderId,
          amount: amount,
          pay_params: {
            appId: payParams.appId || process.env.WECHAT_APPID,
            timeStamp: payParams.timeStamp,
            nonceStr: payParams.nonceStr,
            package: payParams.package,
            signType: payParams.signType,
            paySign: payParams.paySign
          }
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('创建支付订单失败:', error);
    next(error);
  }
});

/**
 * 创建充值订单（JSAPI支付）
 * 用于微信小程序内支付
 */
router.post('/recharge', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body; // 金额单位：元

    // 验证金额
    if (!amount || amount <= 0) {
      return res.status(400).json({
        code: 400,
        message: '充值金额必须大于0'
      });
    }

    // 金额限制（可根据实际需求调整）
    if (amount < 0.01 || amount > 10000) {
      return res.status(400).json({
        code: 400,
        message: '充值金额必须在0.01-10000元之间'
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 生成唯一订单号
      const orderId = wechatPayService.generateOrderId();
      
      // 转换为分（微信支付金额单位）
      const totalFen = Math.floor(amount * 100);

      // 创建支付记录（待支付状态）
      const [result] = await connection.execute(
        `INSERT INTO payments (user_id, amount, type, status, transaction_id, created_at) 
         VALUES (?, ?, 'recharge', 'pending', ?, NOW())`,
        [userId, amount, orderId]
      );

      const paymentId = result.insertId;

      // 获取用户openid
      const [users] = await connection.execute(
        'SELECT openid FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0 || !users[0].openid) {
        await connection.rollback();
        return res.status(400).json({
          code: 400,
          message: '用户信息不完整，请重新登录'
        });
      }

      const openid = users[0].openid;

      // 调用微信支付创建订单
      const payParams = await wechatPayService.createJsapiOrder({
        orderId: orderId,
        description: `轻羽速传-充值${amount}元`,
        total: totalFen,
        openid: openid
      });

      await connection.commit();

      res.json({
        code: 0,
        message: '订单创建成功',
        data: {
          payment_id: paymentId,
          order_id: orderId,
          amount: amount,
          pay_params: payParams // 小程序支付所需参数
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('创建充值订单失败:', error);
    next(error);
  }
});

/**
 * 查询订单支付状态
 */
router.get('/order/:orderId', authenticate, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const connection = await pool.getConnection();

    try {
      // 查询本地订单
      const [payments] = await connection.execute(
        'SELECT * FROM payments WHERE transaction_id = ? AND user_id = ?',
        [orderId, userId]
      );

      if (payments.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '订单不存在'
        });
      }

      const payment = payments[0];

      // 如果订单已完成，直接返回
      if (payment.status === 'completed') {
        return res.json({
          code: 0,
          message: '订单已支付',
          data: {
            status: 'completed',
            payment: payment
          }
        });
      }

      // 查询微信支付订单状态
      try {
        const wxOrder = await wechatPayService.queryOrder(orderId);
        
        // 如果微信支付成功，更新本地订单
        if (wxOrder.trade_state === 'SUCCESS') {
          await connection.beginTransaction();

          // 更新支付记录
          await connection.execute(
            `UPDATE payments SET status = 'completed', updated_at = NOW() 
             WHERE transaction_id = ?`,
            [orderId]
          );

          // 更新用户余额
          await connection.execute(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [payment.amount, userId]
          );

          await connection.commit();

          return res.json({
            code: 0,
            message: '支付成功',
            data: {
              status: 'completed',
              payment: { ...payment, status: 'completed' }
            }
          });
        }

        res.json({
          code: 0,
          message: '查询成功',
          data: {
            status: wxOrder.trade_state,
            payment: payment
          }
        });
      } catch (wxError) {
        console.error('查询微信订单失败:', wxError);
        res.json({
          code: 0,
          message: '查询成功',
          data: {
            status: payment.status,
            payment: payment
          }
        });
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('查询订单失败:', error);
    next(error);
  }
});

/**
 * 关闭订单
 */
router.post('/order/:orderId/close', authenticate, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const connection = await pool.getConnection();

    try {
      // 查询订单
      const [payments] = await connection.execute(
        'SELECT * FROM payments WHERE transaction_id = ? AND user_id = ?',
        [orderId, userId]
      );

      if (payments.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '订单不存在'
        });
      }

      const payment = payments[0];

      if (payment.status !== 'pending') {
        return res.status(400).json({
          code: 400,
          message: '只能关闭待支付订单'
        });
      }

      // 关闭微信支付订单
      await wechatPayService.closeOrder(orderId);

      // 更新本地订单状态
      await connection.execute(
        `UPDATE payments SET status = 'closed', updated_at = NOW() 
         WHERE transaction_id = ?`,
        [orderId]
      );

      res.json({
        code: 0,
        message: '订单已关闭'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('关闭订单失败:', error);
    next(error);
  }
});

/**
 * 微信支付回调接口
 * 接收微信支付成功通知
 */
router.post('/notify', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('收到微信支付回调');

    // 验证签名
    const isValid = wechatPayService.verifySignature(req.headers, req.body);
    
    if (!isValid) {
      console.error('微信支付回调签名验证失败');
      return res.status(401).json({
        code: 'FAIL',
        message: '签名验证失败'
      });
    }

    // 解析请求体
    const body = JSON.parse(req.body.toString());
    
    // 解密回调数据
    const decryptedData = wechatPayService.decryptNotifyData(body.resource);
    const paymentData = JSON.parse(decryptedData);

    console.log('支付回调数据:', paymentData);

    const { out_trade_no, trade_state, transaction_id, payer, amount } = paymentData;

    // 只处理支付成功的回调
    if (trade_state !== 'SUCCESS') {
      return res.json({
        code: 'SUCCESS',
        message: '处理成功'
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 查询订单
      const [payments] = await connection.execute(
        'SELECT * FROM payments WHERE transaction_id = ?',
        [out_trade_no]
      );

      if (payments.length === 0) {
        console.error('订单不存在:', out_trade_no);
        await connection.rollback();
        return res.json({
          code: 'SUCCESS',
          message: '订单不存在'
        });
      }

      const payment = payments[0];

      // 防止重复处理
      if (payment.status === 'completed') {
        console.log('订单已处理，跳过:', out_trade_no);
        await connection.rollback();
        return res.json({
          code: 'SUCCESS',
          message: '订单已处理'
        });
      }

      // 更新支付记录
      await connection.execute(
        `UPDATE payments SET 
          status = 'completed',
          transaction_id = ?,
          updated_at = NOW()
         WHERE transaction_id = ? AND status = 'pending'`,
        [transaction_id, out_trade_no]
      );

      // 根据支付类型处理
      if (payment.type === 'recharge') {
        // 充值：更新用户余额
        await connection.execute(
          'UPDATE users SET balance = balance + ? WHERE id = ?',
          [payment.amount, payment.user_id]
        );
        console.log('充值成功，已更新用户余额');
      } else if (payment.type === 'order' && payment.order_id) {
        // 业务订单支付：更新业务订单状态
        await connection.execute(
          'UPDATE orders SET status = ?, paid_at = NOW() WHERE id = ?',
          ['paid', payment.order_id]
        );
        console.log('订单支付成功，已更新订单状态:', payment.order_id);
      }

      await connection.commit();

      console.log('支付成功，订单已更新:', out_trade_no);

      res.json({
        code: 'SUCCESS',
        message: '处理成功'
      });
    } catch (error) {
      await connection.rollback();
      console.error('处理支付回调失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('支付回调处理异常:', error);
    res.status(500).json({
      code: 'FAIL',
      message: '系统错误'
    });
  }
});

/**
 * 退款回调接口
 */
router.post('/refund-notify', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('收到微信退款回调');

    // 验证签名
    const isValid = wechatPayService.verifySignature(req.headers, req.body);
    
    if (!isValid) {
      console.error('微信退款回调签名验证失败');
      return res.status(401).json({
        code: 'FAIL',
        message: '签名验证失败'
      });
    }

    // 解析请求体
    const body = JSON.parse(req.body.toString());
    
    // 解密回调数据
    const decryptedData = wechatPayService.decryptNotifyData(body.resource);
    const refundData = JSON.parse(decryptedData);

    console.log('退款回调数据:', refundData);

    const { out_trade_no, out_refund_no, refund_status } = refundData;

    if (refund_status === 'SUCCESS') {
      const connection = await pool.getConnection();

      try {
        // 更新退款记录状态（如果有退款表的话）
        // TODO: 根据实际业务需求处理退款成功逻辑
        
        console.log('退款成功:', out_refund_no);
      } finally {
        connection.release();
      }
    }

    res.json({
      code: 'SUCCESS',
      message: '处理成功'
    });
  } catch (error) {
    console.error('退款回调处理异常:', error);
    res.status(500).json({
      code: 'FAIL',
      message: '系统错误'
    });
  }
});

module.exports = router;
