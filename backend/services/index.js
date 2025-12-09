/**
 * 敏感词检测配置
 * 使用 UAPI 云端检测服务
 */

// 使用 UAPI 云端检测 (需要配置 API Key)
console.log('✓ 使用 UAPI 云端敏感词检测服务');
const sensitiveWordService = require('./sensitiveWordCheck');

// 导出统一接口
module.exports = {
  checkSensitiveWord: sensitiveWordService.checkSensitiveWord,
  checkMultipleTexts: sensitiveWordService.checkMultipleTexts,
  mode: 'uapi'
};
