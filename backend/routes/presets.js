const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// 获取预设文案列表（公开接口）
router.get('/', async (req, res, next) => {
  try {
    const { type, category } = req.query;
    const connection = await pool.getConnection();

    try {
      let query = 'SELECT id, type, category, content FROM presets WHERE 1=1';
      const params = [];

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }

      query += ' ORDER BY category, id';

      const [rows] = await connection.execute(query, params);

      // 按分类分组
      const grouped = {};
      rows.forEach(preset => {
        const cat = preset.category || '其他';
        if (!grouped[cat]) {
          grouped[cat] = [];
        }
        grouped[cat].push({
          id: preset.id,
          content: preset.content
        });
      });

      res.json({
        code: 0,
        data: Object.keys(grouped).map(category => ({
          category,
          items: grouped[category]
        }))
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 获取单个预设文案（管理员）
router.get('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT id, type, category, content FROM presets WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '文案不存在'
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

// 创建预设文案（管理员）
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { type, category, content } = req.body;

    if (!type || !category || !content) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数'
      });
    }

    const connection = await pool.getConnection();

    try {
      const [result] = await connection.execute(
        'INSERT INTO presets (type, category, content) VALUES (?, ?, ?)',
        [type, category, content]
      );

      res.json({
        code: 0,
        message: '添加成功',
        data: {
          id: result.insertId
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 更新预设文案（管理员）
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, category, content } = req.body;

    if (!type || !category || !content) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数'
      });
    }

    const connection = await pool.getConnection();

    try {
      const [result] = await connection.execute(
        'UPDATE presets SET type = ?, category = ?, content = ? WHERE id = ?',
        [type, category, content, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          code: 404,
          message: '文案不存在'
        });
      }

      res.json({
        code: 0,
        message: '更新成功'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// 删除预设文案（管理员）
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
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
      const [result] = await connection.execute(
        'DELETE FROM presets WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          code: 404,
          message: '文案不存在'
        });
      }

      res.json({
        code: 0,
        message: '删除成功'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;

