const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ORDER_PRICES } = require('./config');
const { checkSensitiveWord, checkMultipleTexts } = require('../services/index');

const ORDER_TYPES = ['sms', 'call', 'human'];

// 一次性提交Token存储（使用Map管理，生产环境建议使用Redis）
// 格式: Map<token, {userId, type, createdAt, expiresAt}>
const submitTokens = new Map();

// Token有效期（30分钟）
const TOKEN_EXPIRY_TIME = 30 * 60 * 1000;

// 定时清理过期Token（每5分钟）
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of submitTokens.entries()) {
    if (data.expiresAt < now) {
      submitTokens.delete(token);
      console.log(`清理过期Token: ${token}`);
    }
  }
}, 5 * 60 * 1000);

// 生成提交Token
function generateSubmitToken() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `token_${timestamp}_${random}`;
}

// 验证并销毁Token
function validateAndConsumeToken(token, userId, type) {
  if (!token) {
    return { valid: false, message: '缺少提交令牌' };
  }
  
  const tokenData = submitTokens.get(token);
  
  if (!tokenData) {
    return { valid: false, message: '提交令牌无效或已过期' };
  }
  
  // 验证用户ID
  if (tokenData.userId !== userId) {
    return { valid: false, message: '提交令牌不匹配' };
  }
  
  // 验证订单类型
  if (tokenData.type !== type) {
    return { valid: false, message: '订单类型不匹配' };
  }
  
  // 检查是否过期
  if (tokenData.expiresAt < Date.now()) {
    submitTokens.delete(token);
    return { valid: false, message: '提交令牌已过期' };
  }
  
  // 验证成功，销毁Token（一次性使用）
  submitTokens.delete(token);
  console.log(`Token验证成功并已销毁: ${token}`);
  
  return { valid: true };
}

// 手机号校验函数
function validatePhoneNumber(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

// 生成提交Token（需要认证）
router.post('/submit-token', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { type } = req.body;
    
    if (!type || !ORDER_TYPES.includes(type)) {
      return res.status(400).json({
        code: 400,
        message: '无效的订单类型'
      });
    }
    
    // 生成新Token
    const token = generateSubmitToken();
    const now = Date.now();
    
    // 存储Token信息
    submitTokens.set(token, {
      userId,
      type,
      createdAt: now,
      expiresAt: now + TOKEN_EXPIRY_TIME
    });
    
    console.log(`生成提交Token: ${token}, 用户: ${userId}, 类型: ${type}`);
    
    res.json({
      code: 0,
      message: '成功',
      data: {
        token,
        expiresIn: TOKEN_EXPIRY_TIME
      }
    });
  } catch (error) {
    next(error);
  }
});

// 创建订单（需要认证）
router.post('/create', authenticate, async (req, res, next) => {
  try {
    // 使用 token 中的 userId，不信任前端传来的 user_id
    const user_id = req.user.userId;
    const { type, contact_phone, contact_method, content, scheduled_time, remark, idempotency_key, submit_token } = req.body;

    console.log('========== 创建订单请求 ==========');
    console.log('用户ID:', user_id);
    console.log('订单类型:', type);
    console.log('幂等性密钥:', idempotency_key);
    console.log('提交Token:', submit_token ? submit_token.substring(0, 20) + '...' : '无');
    console.log('================================');

    if (!type) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数'
      });
    }
    
    // 【Token验证】验证并消耗一次性Token
    const tokenValidation = validateAndConsumeToken(submit_token, user_id, type);
    if (!tokenValidation.valid) {
      console.log('Token验证失败:', tokenValidation.message);
      return res.status(400).json({
        code: 400,
        message: tokenValidation.message
      });
    }

    // 【幂等性检查】如果提供了幂等性密钥，检查是否已存在相同订单
    if (idempotency_key) {
      const connection = await pool.getConnection();
      try {
        const [existingOrders] = await connection.execute(
          'SELECT id, price, status FROM orders WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
          [user_id, idempotency_key]
        );
        
        if (existingOrders.length > 0) {
          console.log('检测到重复订单，返回已存在的订单:', existingOrders[0].id);
          return res.json({
            code: 0,
            message: '订单已存在',
            data: {
              order_id: existingOrders[0].id,
              price: existingOrders[0].price,
              is_duplicate: true
            }
          });
        }
      } finally {
        connection.release();
      }
    }

    // 【短信业务验证】短信服务只支持单个手机号
    if (type === 'sms') {
      if (!contact_phone) {
        return res.status(400).json({
          code: 400,
          message: '请提供手机号'
        });
      }
      
      // 去除首尾空格
      const trimmedPhone = contact_phone.trim();
      
      // 验证是否包含多个手机号（检查逗号、换行、空格等分隔符）
      if (trimmedPhone.includes(',') || trimmedPhone.includes('\n') || trimmedPhone.includes(' ')) {
        return res.status(400).json({
          code: 400,
          message: '短信服务仅支持单个手机号，不能包含多个号码'
        });
      }
      
      // 验证手机号格式
      if (!validatePhoneNumber(trimmedPhone)) {
        return res.status(400).json({
          code: 400,
          message: '手机号格式不正确，请输入11位有效手机号'
        });
      }
      
      // 验证内容不能为空
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          code: 400,
          message: '短信内容不能为空'
        });
      }
      
      // 验证内容长度（最大500字符）
      if (content.length > 500) {
        return res.status(400).json({
          code: 400,
          message: '短信内容不能超过500个字符'
        });
      }
    }
    
    // 【安全】后端计算价格，不信任前端传来的价格
    let calculatedPrice = 0;
    if (type === 'sms') {
      // 短信按 37 字一条计算
      const contentLength = (content || '').length;
      const smsCount = Math.ceil(contentLength / 37) || 1;
      calculatedPrice = smsCount * ORDER_PRICES.sms;
    } else if (type === 'call') {
      calculatedPrice = ORDER_PRICES.call;
    } else if (type === 'human') {
      // 其他平台价格为 0，其他联系方式使用配置价格
      calculatedPrice = contact_method === '其他平台' ? 0 : ORDER_PRICES.human;
    }
    
    // 保留两位小数
    calculatedPrice = Math.round(calculatedPrice * 100) / 100;
    
    console.log('后端计算价格:', calculatedPrice);

    // 敏感词检测
    if (content) {
      const checkResult = await checkSensitiveWord(content);
      if (!checkResult.pass) {
        return res.status(400).json({
          code: 400,
          message: '内容包含敏感词，请修改后重试',
          data: {
            sensitiveWords: checkResult.sensitiveWords || []
          }
        });
      }
    }

    // 对备注也进行检测
    if (remark) {
      const remarkCheckResult = await checkSensitiveWord(remark);
      if (!remarkCheckResult.pass) {
        return res.status(400).json({
          code: 400,
          message: '备注包含敏感词，请修改后重试',
          data: {
            sensitiveWords: remarkCheckResult.sensitiveWords || []
          }
        });
      }
    }

    const connection = await pool.getConnection();

    try {
      // 先检查用户是否存在
      const [userCheck] = await connection.execute(
        'SELECT id FROM users WHERE id = ?',
        [user_id]
      );

      if (userCheck.length === 0) {
        connection.release();
        return res.status(400).json({
          code: 400,
          message: '用户不存在，请重新登录'
        });
      }

      const [result] = await connection.execute(
        `INSERT INTO orders 
         (user_id, type, contact_phone, contact_method, content, scheduled_time, status, price, remark, idempotency_key) 
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [user_id, type, contact_phone || '', contact_method || '', content || '', scheduled_time || null, calculatedPrice, remark || '', idempotency_key || null]
      );

      res.json({
        code: 0,
        message: '订单创建成功',
        data: {
          order_id: result.insertId,
          price: calculatedPrice // 返回后端计算的价格
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 获取用户订单列表（需要认证）
router.get('/user/:userId', authenticate, async (req, res, next) => {
  try {
    // 只允许用户查看自己的订单
    const authenticatedUserId = req.user.userId;
    const { userId } = req.params;

    if (parseInt(userId) !== authenticatedUserId) {
      return res.status(403).json({
        code: 403,
        message: '您没有权限查看该用户的订单'
      });
    }

    const { status, type } = req.query;

    const connection = await pool.getConnection();

    try {
      let query = 'SELECT * FROM orders WHERE user_id = ?';
      const params = [userId];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      query += ' ORDER BY created_at DESC LIMIT 100';

      const [rows] = await connection.execute(query, params);

      res.json({
        code: 0,
        data: rows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 获取订单详情（需要认证）
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user.userId;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT * FROM orders WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '订单不存在'
        });
      }

      // 验证用户权限
      if (rows[0].user_id !== authenticatedUserId) {
        return res.status(403).json({
          code: 403,
          message: '您没有权限查看该订单'
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

// 更新订单状态（需要认证）
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const authenticatedUserId = req.user.userId;

    if (!status) {
      return res.status(400).json({
        code: 400,
        message: '状态不能为空'
      });
    }

    const connection = await pool.getConnection();

    try {
      // 验证订单所有权
      const [rows] = await connection.execute(
        'SELECT user_id FROM orders WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '订单不存在'
        });
      }

      if (rows[0].user_id !== authenticatedUserId) {
        return res.status(403).json({
          code: 403,
          message: '您没有权限修改该订单'
        });
      }

      await connection.execute(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, id]
      );

      res.json({
        code: 0,
        message: '订单状态更新成功'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 电话业务订单专用接口（需要认证）
router.post('/call/validate-and-create', authenticate, async (req, res, next) => {
  try {
    const user_id = req.user.userId; // 使用 token 中的用户 ID
    const { contact_phone } = req.body;

    // 参数校验
    if (!contact_phone) {
      return res.status(400).json({
        code: 400,
        message: '请输入对方手机号'
      });
    }

    // 手机号格式校验
    if (!validatePhoneNumber(contact_phone)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的手机号码'
      });
    }

    const connection = await pool.getConnection();

    try {
      // 检查用户余额
      const [userRows] = await connection.execute(
        'SELECT balance FROM users WHERE id = ?',
        [user_id]
      );

      if (userRows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在'
        });
      }

      const userBalance = userRows[0].balance;
      const callPrice = ORDER_PRICES.call;

      if (userBalance < callPrice) {
        return res.status(400).json({
          code: 400,
          message: `余额不足，需要 ¥${callPrice}，当前余额 ¥${userBalance}`,
          data: {
            required: callPrice,
            current: userBalance
          }
        });
      }

      // 创建订单
      const [result] = await connection.execute(
        `INSERT INTO orders 
         (user_id, type, contact_phone, contact_method, status, price, remark) 
         VALUES (?, 'call', ?, '手机电话', 'pending', ?, '电话业务订单')`,
        [user_id, contact_phone, callPrice]
      );

      res.json({
        code: 0,
        message: '订单创建成功',
        data: {
          order_id: result.insertId,
          price: callPrice,
          contact_phone: contact_phone
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
