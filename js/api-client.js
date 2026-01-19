/**
 * API Client - 统一封装所有 API 请求
 * 自动处理：
 * - CSRF Token 获取、存储和使用
 * - JWT Token 认证
 * - 错误处理和重试
 * - 响应拦截
 */

class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.csrfToken = null;
    this.authToken = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * 初始化 API Client - 获取 CSRF Token
   */
  async init() {
    if (this.isInitialized) {
      return this.csrfToken;
    }

    // 防止并发初始化
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._fetchCSRFToken();
    
    try {
      await this.initPromise;
      this.isInitialized = true;
      return this.csrfToken;
    } catch (error) {
      console.error('初始化 API Client 失败:', error);
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * 获取 CSRF Token
   */
  async _fetchCSRFToken() {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // 如果已有 token，发送给后端检查是否仍然有效
      const existingToken = this.csrfToken || sessionStorage.getItem('csrf_token');
      if (existingToken) {
        headers['X-CSRF-Token'] = existingToken;
      }
      
      const response = await fetch(`${this.baseURL}/csrf-token`, {
        method: 'GET',
        credentials: 'include',
        headers: headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.code === 0 && data.data && data.data.csrfToken) {
        this.csrfToken = data.data.csrfToken;
        sessionStorage.setItem('csrf_token', this.csrfToken);
        return this.csrfToken;
      } else {
        throw new Error('CSRF Token 响应格式错误');
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 刷新 CSRF Token
   */
  async refreshCSRFToken() {
    // 清除旧token
    this.isInitialized = false;
    this.initPromise = null;
    this.csrfToken = null;
    sessionStorage.removeItem('csrf_token');
    
    const newToken = await this.init();
    return newToken;
  }

  /**
   * 获取当前 CSRF Token（优先从内存，其次从 sessionStorage）
   */
  getCSRFToken() {
    // 优先返回内存中的token
    if (this.csrfToken) {
      return this.csrfToken;
    }
    
    // 尝试从 sessionStorage 恢复（但不应在刷新过程中使用旧token）
    if (!this.isInitialized) {
      const stored = sessionStorage.getItem('csrf_token');
      if (stored) {
        this.csrfToken = stored;
        this.isInitialized = true;
        return stored;
      }
    }
    
    return this.csrfToken;
  }

  /**
   * 设置认证 Token
   */
  setAuthToken(token) {
    this.authToken = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  /**
   * 获取认证 Token
   */
  getAuthToken() {
    if (this.authToken) {
      return this.authToken;
    }
    
    // 尝试从 localStorage 恢复
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      this.authToken = stored;
      return stored;
    }
    
    return null;
  }

  /**
   * 清除所有 Token
   */
  clearTokens() {
    this.authToken = null;
    this.csrfToken = null;
    this.isInitialized = false;
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('csrf_token');
  }

  /**
   * 构建请求头
   */
  _buildHeaders(options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // 添加认证 Token
    const authToken = this.getAuthToken();
    if (authToken && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // 对于非 GET 请求，添加 CSRF Token
    const method = (options.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrfToken = this.getCSRFToken();
      if (csrfToken && !options.skipCSRF) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return headers;
  }

  /**
   * 处理响应
   */
  async _handleResponse(response, options = {}) {
    let data;
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (error) {
      throw new Error('响应解析失败');
    }

    // 成功响应
    if (response.ok) {
      return data;
    }

    // 401 未授权 - Token 失效
    if (response.status === 401) {
      console.warn('Token 无效或已过期');
      
      // 检查是否是登录/注册相关的请求
      const isAuthRequest = options._originalUrl && (
        options._originalUrl.includes('/auth/login-password') ||
        options._originalUrl.includes('/auth/register') ||
        options._originalUrl.includes('/auth/login')
      );
      
      // 只有非登录请求的 401 才清除 Token 并触发跳转
      if (!isAuthRequest) {
        this.clearTokens();
        // 触发全局事件，让页面处理跳转
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      
      throw new Error(data.message || '认证失败，请重新登录');
    }

    // 403 错误处理 - 区分 CSRF Token 失效和其他权限问题
    if (response.status === 403) {
      const method = (options.method || 'GET').toUpperCase();
      const errorMessage = data.message || '';
      
      // 检查是否是 CSRF Token 相关错误
      const isCSRFError = errorMessage.toLowerCase().includes('csrf') || 
                          errorMessage.toLowerCase().includes('token');
      
      // 检查是否应该重试（未重试过 + 非GET请求 + 是CSRF错误）
      const shouldRetry = !options._retried && 
                          !['GET', 'HEAD', 'OPTIONS'].includes(method) &&
                          isCSRFError;
      
      if (shouldRetry) {
        try {
          await this.refreshCSRFToken();
          return await this.request(options._originalUrl, {
            ...options,
            _retried: true
          });
        } catch (error) {
          throw new Error('验证失败，请刷新页面重试');
        }
      } else if (options._retried) {
        throw new Error(errorMessage || '请求被拒绝');
      } else if (!isCSRFError) {
        throw new Error(errorMessage || '没有权限访问');
      }
    }

    // 其他错误
    throw new Error(data.message || `请求失败 (${response.status})`);
  }

  /**
   * 通用请求方法
   */
  async request(endpoint, options = {}) {
    // 确保已初始化（对于需要 CSRF 的请求）
    const method = (options.method || 'GET').toUpperCase();
    const needsCSRF = !['GET', 'HEAD', 'OPTIONS'].includes(method) && !options.skipCSRF;
    
    if (needsCSRF && !this.isInitialized) {
      try {
        await this.init();
      } catch (error) {
        // 初始化失败，继续尝试发送请求
      }
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    const headers = this._buildHeaders(options);

    const fetchOptions = {
      method: method,
      headers,
      credentials: 'include', // 重要：支持跨域携带cookies
      ...options
    };

    // 如果有 body 且是对象，转为 JSON
    if (options.body && typeof options.body === 'object') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    // 保存原始 URL 用于重试
    options._originalUrl = endpoint;

    try {
      const response = await fetch(url, fetchOptions);
      return await this._handleResponse(response, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET 请求
   */
  async get(endpoint, params = {}, options = {}) {
    let url = endpoint;
    
    // 添加查询参数
    if (params && Object.keys(params).length > 0) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query.append(key, value);
        }
      });
      const queryString = query.toString();
      if (queryString) {
        url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryString}`;
      }
    }

    return this.request(url, { method: 'GET', ...options });
  }

  /**
   * POST 请求
   */
  async post(endpoint, data = {}, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
      ...options
    });
  }

  /**
   * PUT 请求
   */
  async put(endpoint, data = {}, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
      ...options
    });
  }

  /**
   * PATCH 请求
   */
  async patch(endpoint, data = {}, options = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: data,
      ...options
    });
  }

  /**
   * DELETE 请求
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...options
    });
  }
}

// 创建全局单例实例
// 必须先加载 config.js，不应该有默认的 localhost 值
// 如果没有设置则提示错误
if (!window.API_BASE_URL) {
  throw new Error('API_BASE_URL configuration missing');
}

const apiClient = new APIClient(window.API_BASE_URL);

// 自动初始化（获取 CSRF Token）
apiClient.init().catch(() => {
  // 初始化失败，将在首次请求时重试
});

// 导出单例到全局
window.apiClient = apiClient;
window.APIClient = APIClient;

// 监听认证过期事件
window.addEventListener('auth:expired', () => {
  console.log('🔄 认证已过期，已自动清除登录状态');
  
  // 清除用户信息
  localStorage.removeItem('userInfo');
  
  // 静默处理，不显示alert，让用户自然地重新登录
});


