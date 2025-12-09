const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { checkSensitiveWord, checkMultipleTexts, mode } = require('../services/index');

/**
 * 获取敏感词检测服务状态
 * GET /api/sensitive-word/status
 */
router.get('/status', (req, res) => {
  res.json({
    code: 0,
    message: '服务运行正常',
    data: {
      mode: mode, // 'local' 或 'uapi'
      description: mode === 'local' ? '本地敏感词检测' : 'UAPI 云端检测',
      available: true
    }
  });
});

/**
 * 单个文本敏感词检测
 * POST /api/sensitive-word/check
 * Body: { text: "要检测的文本" }
 */
router.post('/check', authenticate, async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        code: 400,
        message: '请提供要检测的文本'
      });
    }

    const result = await checkSensitiveWord(text);

    res.json({
      code: 0,
      message: result.pass ? '文本检测通过' : '文本包含敏感词',
      data: {
        pass: result.pass,
        sensitiveWords: result.sensitiveWords || [],
        details: result.data
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 批量文本敏感词检测
 * POST /api/sensitive-word/check-batch
 * Body: { texts: ["文本1", "文本2", ...] }
 */
router.post('/check-batch', authenticate, async (req, res, next) => {
  try {
    const { texts } = req.body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '请提供要检测的文本数组'
      });
    }

    if (texts.length > 10) {
      return res.status(400).json({
        code: 400,
        message: '单次最多检测10个文本'
      });
    }

    const result = await checkMultipleTexts(texts);

    res.json({
      code: 0,
      message: result.pass ? '所有文本检测通过' : `发现${result.failedCount}个文本包含敏感词`,
      data: {
        pass: result.pass,
        failedCount: result.failedCount,
        results: result.results
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
