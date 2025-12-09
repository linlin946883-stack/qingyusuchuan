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

module.exports = router;

