/**
 * 敏感词检测服务
 * 使用 UAPI 敏感词识别 API (直接 HTTP 调用,不使用 SDK)
 */

/**
 * 检测文本中的敏感词
 * @param {string} text - 要检测的文本
 * @returns {Promise<Object>} 检测结果
 */
async function checkSensitiveWord(text) {
  try {
    if (!text || typeof text !== 'string') {
      return {
        pass: true,
        message: '文本为空',
        sensitiveWords: [],
        data: null
      };
    }

    // 去除前后空格
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return {
        pass: true,
        message: '文本为空',
        sensitiveWords: [],
        data: null
      };
    }

    // 直接使用 fetch 调用 UAPI API
    console.log('发送敏感词检测请求:', { text: trimmedText.substring(0, 50) + '...' });
    
    const response = await fetch('https://uapis.cn/api/v1/text/profanitycheck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: trimmedText })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('敏感词检测响应:', data);
    
    // 根据 API 返回结果判断
    // status: "ok" 表示安全, "forbidden" 表示有敏感词
    const pass = data.status === 'ok' || data.status !== 'forbidden';
    
    return {
      pass: pass,
      message: pass ? '检测通过' : '检测到敏感词',
      data: data,
      sensitiveWords: data.forbidden_words || []
    };
  } catch (error) {
    console.error('敏感词检测失败:', error.message);
    
    // 如果是 HTTP 错误,记录详细信息
    if (error.response) {
      console.error('响应错误:', {
        status: error.response.status,
        statusText: error.response.statusText
      });
    }
    
    // 如果检测服务出错，默认不拦截（根据业务需求调整）
    return {
      pass: true,
      message: '检测服务暂时不可用',
      error: error.message,
      data: null
    };
  }
}

/**
 * 批量检测多个文本
 * @param {Array<string>} texts - 要检测的文本数组
 * @returns {Promise<Object>} 检测结果
 */
async function checkMultipleTexts(texts) {
  try {
    const results = await Promise.all(
      texts.map(text => checkSensitiveWord(text))
    );

    const allPass = results.every(r => r.pass);
    const failedResults = results.filter(r => !r.pass);

    return {
      pass: allPass,
      results: results,
      failedCount: failedResults.length,
      failedResults: failedResults
    };
  } catch (error) {
    console.error('批量敏感词检测失败:', error);
    return {
      pass: true, // 出错时默认不拦截
      error: error.message,
      results: []
    };
  }
}

module.exports = {
  checkSensitiveWord,
  checkMultipleTexts
};
