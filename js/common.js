// ==================== 弹窗背景滚动控制 ====================

/**
 * 禁止页面滚动（打开弹窗时调用）
 */
function disableBodyScroll() {
  // 记录当前滚动位置
  const scrollY = window.scrollY;
  document.body.style.top = `-${scrollY}px`;
  document.body.classList.add('modal-open');
}

/**
 * 恢复页面滚动（关闭弹窗时调用）
 */
function enableBodyScroll() {
  const scrollY = document.body.style.top;
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  // 恢复滚动位置
  if (scrollY) {
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
  }
}

// ==================== Toast 提示 ====================

// HTML 转义函数 - 防止 XSS 攻击
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示吐司提示
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  // 使用 textContent 而不是 innerHTML 防止 XSS
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, duration);
}

// 显示加载提示
function showLoading(message = '加载中...') {
  const loading = document.createElement('div');
  loading.className = 'toast';
  loading.id = 'loading-toast';
  loading.innerHTML = `<div class="loading"></div> ${message}`;
  document.body.appendChild(loading);
}

// 隐藏加载提示
function hideLoading() {
  const loading = document.getElementById('loading-toast');
  if (loading) {
    loading.remove();
  }
}

// 本地存储工具
const storage = {
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('❌ localStorage.setItem 失败:', error);
      // 可能是隐私模式或存储已满
      if (error.name === 'QuotaExceededError') {
        console.error('存储空间已满');
      } else if (error.name === 'SecurityError') {
        console.error('安全错误，可能是隐私模式');
      }
      return false;
    }
  },
  
  get(key) {
    try {
      const value = localStorage.getItem(key);
      try {
        return value ? JSON.parse(value) : null;
      } catch {
        return value;
      }
    } catch (error) {
      console.error('❌ localStorage.getItem 失败:', error);
      return null;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('❌ localStorage.removeItem 失败:', error);
      return false;
    }
  },
  
  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('❌ localStorage.clear 失败:', error);
      return false;
    }
  }
};

// API 基础URL - 从 config.js 读取
// 生产环境必须在 config.js 中正确设置 window.API_BASE_URL
if (!window.API_BASE_URL) {
  console.error('❌ 错误：API_BASE_URL 未配置！请确保在 config.js 中正确设置');
  throw new Error('API_BASE_URL configuration missing');
}

// ==================== Token 管理 ====================

/**
 * 保存 Token 到本地存储
 */
function setToken(token) {
  if (!token) {
    console.error('❌ 尝试保存空token!');
    return false;
  }
  
  console.log('💾 保存 Token 到 localStorage');
  try {
    // 直接写入原始字符串，避免被 JSON.stringify 包装
    localStorage.setItem('auth_token', token);
    // 验证保存是否成功
    const saved = localStorage.getItem('auth_token');
    if (saved === token) {
      console.log('✅ Token 保存成功，长度:', token.length);
      return true;
    }
    console.error('❌ Token 保存失败! 保存的值不匹配');
    console.error('原始token长度:', token.length, '读取的token:', saved ? saved.length : 'null');
    return false;
  } catch (error) {
    console.error('❌ Token 保存异常:', error);
    return false;
  }
}

/**
 * 从本地存储获取 Token
 */
function getToken() {
  let token = localStorage.getItem('auth_token');
  // 兼容历史 JSON.stringify 版本（带引号）
  if (token && token.startsWith('"') && token.endsWith('"')) {
    try {
      token = JSON.parse(token);
    } catch {
      // 保留原值
    }
  }
  if (token) {
    console.log('📖 从 localStorage 读取到 Token');
  } else {
    console.log('❌ localStorage 中没有 Token');
  }
  return token;
}

/**
 * 清除 Token
 */
function removeToken() {
  const currentToken = localStorage.getItem('auth_token');
  console.log('🗑️ 清除 Token，当前token存在:', !!currentToken);
  console.trace('removeToken 调用栈:');
  localStorage.removeItem('auth_token');
  // 验证清除
  const afterRemove = localStorage.getItem('auth_token');
  if (afterRemove) {
    console.error('⚠️ 警告: Token清除失败，仍然存在!');
  } else {
    console.log('✅ Token已成功清除');
  }
}

/**
 * 检查 Token 是否存在
 */
function hasToken() {
  return !!getToken();
}

/**
 * 使用 Token 构建请求头
 */
function getAuthHeaders() {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 处理 API 错误响应
 */
function handleApiError(response, data) {
  if (response.status === 401) {
    console.log('🔄 Token已过期，已自动清除，请重新登录');
    
    // Token 无效或过期 - 静默清除
    removeToken();
    storage.remove('userInfo');
    
    // 不显示alert，让用户自然地点击登录
  }
  return data;
}

// ==================== 用户信息管理 ====================

// 获取当前用户信息
function getUserInfo() {
  const userInfo = storage.get('userInfo');
  if (!userInfo) {
    return null;
  }
  return userInfo;
}

// 设置用户信息
function setUserInfo(userInfo) {
  storage.set('userInfo', userInfo);
}

// 清除用户信息
function clearUserInfo() {
  storage.remove('userInfo');
  removeToken();
}

// 刷新用户信息
async function refreshUserInfo() {
  if (!hasToken()) {
    return null;
  }
  try {
    const data = await apiClient.get('/auth/user');
    if (data.code === 0 && data.data) {
      const user = data.data;
      const userInfo = {
        user_id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatar: user.avatar,
        phone: user.phone,
        balance: user.balance,
        role: user.role || 'user'
      };
      setUserInfo(userInfo);
      return userInfo;
    }
  } catch (error) {
    console.error('刷新用户信息失败:', error);
  }
  return null;
}

// ==================== 业务接口 ====================

/**
 * 生成唯一的幂等性密钥
 * 格式: userId_timestamp_random
 */
function generateIdempotencyKey() {
  const userInfo = getUserInfo();
  const userId = userInfo ? userInfo.id : 'guest';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${userId}_${timestamp}_${random}`;
}

/**
 * 生成一次性提交Token
 * 用于防止表单重复提交和CSRF攻击
 */
function generateSubmitToken() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const token = `token_${timestamp}_${random}`;
  return token;
}

/**
 * 请求一次性提交Token
 * 从服务器获取有效的提交Token
 */
async function requestSubmitToken(type) {
  // 检查是否已登录
  if (!hasToken()) {
    return null; // 静默返回
  }
  
  try {
    const data = await apiClient.post('/orders/submit-token', { type });
    
    if (data.code === 0 && data.data && data.data.token) {
      return data.data.token;
    }
    
    return null;
  } catch (error) {
    // 静默失败，只在开发环境输出
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.warn('Token获取失败（开发）:', error.message);
    }
    return null;
  }
}

// 创建订单
async function createOrder(type, contactPhone, contactMethod, content, scheduledTime, price, remark, submitToken = null) {
  try {
    // 参数验证
    if (!type) {
      throw new Error('订单类型不能为空');
    }
    
    // 短信服务必须提供手机号
    if (type === 'sms' && !contactPhone) {
      throw new Error('请提供手机号');
    }
    
    // 短信服务验证单个手机号
    if (type === 'sms') {
      // 检查是否包含多个手机号
      if (contactPhone.includes(',') || contactPhone.includes('\n') || contactPhone.includes(' ')) {
        throw new Error('短信服务仅支持单个手机号');
      }
      
      // 验证手机号格式
      if (!/^1[3-9]\d{9}$/.test(contactPhone.trim())) {
        throw new Error('手机号格式不正确');
      }
    }
    
    // 如果没有提供submitToken，尝试请求一个
    if (!submitToken) {
      submitToken = await requestSubmitToken(type);
      if (!submitToken) {
        throw new Error('无法获取提交令牌，请刷新页面重试');
      }
    }
    
    // 生成幂等性密钥
    const idempotencyKey = generateIdempotencyKey();
    
    const data = await apiClient.post('/orders/create', {
      type,
      contact_phone: contactPhone,
      contact_method: contactMethod,
      content,
      scheduled_time: scheduledTime,
      price,
      remark,
      idempotency_key: idempotencyKey,
      submit_token: submitToken
    });
    
    return data;
  } catch (error) {
    console.error('创建订单失败:', error);
    return {
      code: 500,
      message: error.message || '网络错误'
    };
  }
}

// 获取用户订单
async function getOrders(userId) {
  try {
    const data = await apiClient.get(`/orders/user/${userId}`);
    return data;
  } catch (error) {
    console.error('获取订单失败:', error);
    return {
      code: 500,
      message: '网络错误',
      data: []
    };
  }
}

// 获取单个订单详情
async function getOrderDetail(orderId) {
  try {
    const data = await apiClient.get(`/orders/${orderId}`);
    return data;
  } catch (error) {
    console.error('获取订单详情失败:', error);
    return {
      code: 500,
      message: '网络错误'
    };
  }
}

// 获取预设文案
async function getPresets(type = 'sms') {
  try {
    const params = type ? { type } : {};
    const data = await apiClient.get('/presets', params, { skipCSRF: true });
    
    if (data.code === 0 && data.data) {
      // 转换返回格式为 { 分类名: [文案列表] }
      const result = {};
      data.data.forEach(group => {
        result[group.category] = group.items.map(item => item.content);
      });
      return result;
    }
    return {};
  } catch (error) {
    console.error('获取预设文案失败:', error);
    return {};
  }
}

// 获取价格配置（公开接口，无需认证）
async function getPrices() {
  try {
    const data = await apiClient.get('/config/prices', {}, { skipAuth: true, skipCSRF: true });
    
    if (data.code === 0 && data.data) {
      return data.data;
    }
    // 返回默认价格（防止API失败）
    return {
      sms: 2.99,
      call: 19.00,
      human: 29.00
    };
  } catch (error) {
    console.error('获取价格配置失败:', error);
    // 返回默认价格
    return {
      sms: 2.99,
      call: 19.00,
      human: 29.00
    };
  }
}

// 充值
async function rechargeBalance(amount) {
  try {
    const data = await apiClient.post('/payment/recharge', { amount });
    return data;
  } catch (error) {
    console.error('充值失败:', error);
    return {
      code: 500,
      message: '网络错误'
    };
  }
}

// ==================== 工具函数 ====================

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

// 截断内容
function truncateContent(content, length = 60) {
  if (!content) return '';
  return content.length > length ? content.substring(0, length) + '...' : content;
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

