const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { generateToken, authenticate } = require('../middleware/auth');

// 校验手机号格式
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone || '');
}

// 用户注册/登录（微信授权登录流程）
router.post('/login', async (req, res, next) => {
  try {
    const { openid, nickname, avatar, phone } = req.body;
    
    if (!openid) {
      return res.status(400).json({
        code: 400,
        message: 'openid不能为空'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // 查询用户
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE openid = ?',
        [openid]
      );

      let user;
      if (rows.length > 0) {
        // 用户已存在，更新信息
        user = rows[0];
        await connection.execute(
          'UPDATE users SET nickname = ?, avatar = ?, phone = ?, updated_at = NOW() WHERE id = ?',
          [nickname || user.nickname, avatar || user.avatar, phone || user.phone, user.id]
        );
        user = { 
          ...user, 
          nickname: nickname || user.nickname, 
          avatar: avatar || user.avatar, 
          phone: phone || user.phone 
        };
      } else {
        // 创建新用户
        const [result] = await connection.execute(
          'INSERT INTO users (openid, nickname, avatar, phone) VALUES (?, ?, ?, ?)',
          [openid, nickname || '用户', avatar || '', phone || '']
        );
        user = {
          id: result.insertId,
          openid,
          phone: phone || '',
          nickname: nickname || '用户',
          avatar: avatar || '',
          balance: 0,
          role: 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      // 生成 JWT Token
      const token = generateToken({
        userId: user.id,
        openid: user.openid,
        phone: user.phone,
        role: user.role || 'user'
      });

      res.json({
        code: 0,
        message: '登录成功',
        data: {
          user: {
            id: user.id,
            openid: user.openid,
            phone: user.phone,
            nickname: user.nickname,
            avatar: user.avatar,
            balance: user.balance,
            role: user.role || 'user'
          },
          token: token
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 查询手机号是否已注册
router.get('/phone/:phone', async (req, res, next) => {
  try {
    const { phone } = req.params;

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        code: 400,
        message: '手机号格式不正确'
      });
    }

    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT id FROM users WHERE phone = ? LIMIT 1',
        [phone]
      );

      res.json({
        code: 0,
        data: {
          exists: rows.length > 0
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 用户名密码注册（可选功能）
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, phone } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        message: '用户名和密码不能为空'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        code: 400,
        message: '密码长度不能少于6位'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // 检查用户名是否已存在
      const [existingUsers] = await connection.execute(
        'SELECT id FROM users WHERE phone = ? LIMIT 1',
        [phone]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          code: 400,
          message: '该手机号已注册'
        });
      }

      // 密码加密
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      const [result] = await connection.execute(
        'INSERT INTO users (phone, password_hash, nickname) VALUES (?, ?, ?)',
        [phone, hashedPassword, username]
      );

      const user = {
        id: result.insertId,
        phone,
        nickname: username,
        avatar: '',
        balance: 0,
        role: 'user'
      };

      // 生成 JWT Token
      const token = generateToken({
        userId: user.id,
        phone: user.phone,
        role: user.role || 'user'
      });

      res.json({
        code: 0,
        message: '注册成功',
        data: {
          user,
          token
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 用户名密码登录
router.post('/login-password', async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({
        code: 400,
        message: '手机号和密码不能为空'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      // 查询用户
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE phone = ? LIMIT 1',
        [phone]
      );

      if (rows.length === 0) {
        return res.status(401).json({
          code: 401,
          message: '用户不存在或密码错误'
        });
      }

      const user = rows[0];

      // 验证密码
      if (!user.password_hash || !await bcrypt.compare(password, user.password_hash)) {
        return res.status(401).json({
          code: 401,
          message: '用户不存在或密码错误'
        });
      }

      // 生成 JWT Token
      const token = generateToken({
        userId: user.id,
        phone: user.phone,
        role: user.role || 'user'
      });

      res.json({
        code: 0,
        message: '登录成功',
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            avatar: user.avatar,
            balance: user.balance,
            role: user.role || 'user'
          },
          token
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 验证 Token 有效性
router.get('/verify', authenticate, async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT id, phone, nickname, avatar, balance, role FROM users WHERE id = ? LIMIT 1',
        [req.user.userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在'
        });
      }

      res.json({
        code: 0,
        message: '令牌有效',
        data: rows[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 获取用户信息（需要认证）
router.get('/user', authenticate, async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT id, openid, phone, nickname, avatar, balance, role, created_at, updated_at FROM users WHERE id = ?',
        [req.user.userId]
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

// 获取用户信息（不需要认证）- 保留用于后向兼容
router.get('/user/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT id, openid, phone, nickname, avatar, balance, role, created_at, updated_at FROM users WHERE id = ?',
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

/**
 * 生成微信网页授权 URL
 * @query {string} redirectPath - 授权后要跳转的页面路径（可选）
 * @query {string} scope - 授权作用域，默认 snsapi_base（可选：snsapi_base 或 snsapi_userinfo）
 */
router.get('/wechat/auth-url', (req, res) => {
  try {
    const wechatConfig = require('../config/wechat');
    const { redirectPath = '/pages/my.html', scope = 'snsapi_base', state = '' } = req.query;
    
    // 授权后的回调地址（需要在微信公众平台配置网页授权域名）
    const redirectUri = `https://i.lov2u.cn/api/auth/wechat/callback`;
    
    // 构建微信授权 URL
    const authUrl = 
      `https://open.weixin.qq.com/connect/oauth2/authorize` +
      `?appid=${wechatConfig.appid}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&state=${encodeURIComponent(state || redirectPath)}` +
      `#wechat_redirect`;
    
    res.json({
      code: 0,
      message: '成功',
      data: {
        authUrl,
        tips: '请将用户重定向到此 URL 进行微信授权'
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '生成授权链接失败',
      error: error.message
    });
  }
});

/**
 * 微信授权回调接口
 * 用户授权后，微信会重定向到这个地址，并带上 code 参数
 */
router.get('/wechat/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const wechatConfig = require('../config/wechat');
    const axios = require('axios');
    
    if (!code) {
      return res.redirect('/pages/login.html?error=授权失败');
    }
    
    // 1. 通过 code 获取 access_token 和 openid
    const tokenUrl = 
      `https://api.weixin.qq.com/sns/oauth2/access_token` +
      `?appid=${wechatConfig.appid}` +
      `&secret=${wechatConfig.appSecret}` +
      `&code=${code}` +
      `&grant_type=authorization_code`;
    
    const tokenResponse = await axios.get(tokenUrl);
    const { access_token, openid, scope } = tokenResponse.data;
    
    if (!openid) {
      return res.redirect('/pages/login.html?error=获取用户信息失败');
    }
    
    let userInfo = { openid };
    
    // 2. 如果是 snsapi_userinfo 作用域，获取用户详细信息
    if (scope === 'snsapi_userinfo' && access_token) {
      const userInfoUrl = 
        `https://api.weixin.qq.com/sns/userinfo` +
        `?access_token=${access_token}` +
        `&openid=${openid}` +
        `&lang=zh_CN`;
      
      const userInfoResponse = await axios.get(userInfoUrl);
      userInfo = {
        openid: userInfoResponse.data.openid,
        nickname: userInfoResponse.data.nickname,
        avatar: userInfoResponse.data.headimgurl,
        sex: userInfoResponse.data.sex,
        province: userInfoResponse.data.province,
        city: userInfoResponse.data.city,
        country: userInfoResponse.data.country
      };
    }
    
    // 3. 自动登录/注册用户
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE openid = ?',
        [openid]
      );
      
      let user;
      if (rows.length > 0) {
        // 更新用户信息
        user = rows[0];
        if (userInfo.nickname) {
          await connection.execute(
            'UPDATE users SET nickname = ?, avatar = ?, updated_at = NOW() WHERE id = ?',
            [userInfo.nickname, userInfo.avatar || user.avatar, user.id]
          );
          user.nickname = userInfo.nickname;
          user.avatar = userInfo.avatar || user.avatar;
        }
      } else {
        // 创建新用户
        const [result] = await connection.execute(
          'INSERT INTO users (openid, nickname, avatar) VALUES (?, ?, ?)',
          [openid, userInfo.nickname || '微信用户', userInfo.avatar || '']
        );
        user = {
          id: result.insertId,
          openid,
          nickname: userInfo.nickname || '微信用户',
          avatar: userInfo.avatar || '',
          balance: 0,
          role: 'user'
        };
      }
      
      // 4. 生成 token
      const token = generateToken({
        userId: user.id,
        openid: user.openid,
        phone: user.phone || '',
        role: user.role || 'user'
      });
      
      // 5. 重定向到目标页面，并通过 URL 参数传递 token
      const redirectPath = state || '/pages/my.html';
      res.redirect(`${redirectPath}?token=${token}&openid=${openid}`);
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('微信授权回调错误:', error);
    res.redirect('/pages/login.html?error=' + encodeURIComponent(error.message));
  }
});

module.exports = router;

