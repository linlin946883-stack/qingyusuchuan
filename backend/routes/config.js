const express = require('express');
const router = express.Router();

// 业务价格配置（这是唯一需要修改的地方）
const ORDER_PRICES = {
  sms: 2.99,      // 每条短信价格
  call: 19.00,    // 电话服务价格
  human: 25.00    // 人工传话价格
};

// 获取价格配置（公开接口，无需认证）
router.get('/prices', (req, res) => {
  res.json({
    code: 0,
    data: ORDER_PRICES
  });
});

module.exports = { router, ORDER_PRICES };
