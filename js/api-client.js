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
      const response = await fetch(`${this.baseURL}/csrf-token`, {
        method: 'GET',
        credentials: 'include', // 重要：携带cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        // 提供详细的错误信息
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        
        if (response.status === 0) {
          errorMsg = 'CORS错误：无法连接到API服务器，请检查服务器配置';
        } else if (response.status === 403) {
          errorMsg = 'CORS或安全策略错误：请确保当前域名在服务器允许列表中';
        }
        
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      
      if (data.code === 0 && data.data && data.data.csrfToken) {
        this.csrfToken = data.data.csrfToken;
        sessionStorage.setItem('csrf_token', this.csrfToken);
        console.log('✓ CSRF Token 获取成功');
        return this.csrfToken;
      } else {
        throw new Error('CSRF Token 格式错误');
      }
    } catch (error) {
      console.error('获取 CSRF Token 失败:', error);
      
      // 如果是网络错误，提供更详细的提示
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('网络错误提示：');
        console.error('1. 检查API服务器是否运行');
        console.error('2. 检查CORS配置是否包含当前域名:', window.location.origin);
        console.error('3. API地址:', this.baseURL);
      }
      
      throw error;
    }
  }

  /**
   * 刷新 CSRF Token
   */
  async refreshCSRFToken() {
    console.log('刷新 CSRF Token...');
    this.isInitialized = false;
    this.initPromise = null;
    this.csrfToken = null;
    sessionStorage.removeItem('csrf_token');
    return await this.init();
  }

  /**
   * 获取当前 CSRF Token（优先从内存，其次从 sessionStorage）
   */
  getCSRFToken() {
    if (this.csrfToken) {
      return this.csrfToken;
    }
    
    // 尝试从 sessionStorage 恢复
    const stored = sessionStorage.getItem('csrf_token');
    if (stored) {
      this.csrfToken = stored;
      this.isInitialized = true;
      console.log('✓ 从 sessionStorage 恢复 CSRF Token:', stored.substring(0, 16) + '...');
      return stored;
    }
    
    console.warn('⚠ CSRF Token 不可用，可能需要初始化');
    return null;
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
        console.log(`→ [${method}] 添加CSRF Token: ${csrfToken.substring(0, 16)}...`);
      } else {
        console.warn(`⚠ [${method}] CSRF Token不可用:`, { 
          hasToken: !!csrfToken, 
          skipCSRF: options.skipCSRF,
          isInitialized: this.isInitialized
        });
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

    // 403 CSRF Token 失效
    if (response.status === 403 && data.message && data.message.includes('CSRF')) {
      console.warn('CSRF Token 失效，正在重新获取...');
      
      // 如果没有设置不重试，则刷新 CSRF 并重试
      if (!options._retried) {
        try {
          await this.refreshCSRFToken();
          // 标记为已重试，避免无限循环
          return await this.request(options._originalUrl, {
            ...options,
            _retried: true
          });
        } catch (error) {
          throw new Error('CSRF Token 刷新失败');
        }
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
        console.error('API Client 初始化失败:', error);
        // 继续执行，让后端返回 403
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
      console.error('请求失败:', error);
      
      // 提供网络错误的详细信息
      if (error.name === 'TypeError') {
        console.error('可能的原因：');
        console.error('1. CORS配置错误');
        console.error('2. API服务器未运行');
        console.error('3. 网络连接问题');
        console.error('请求地址:', url);
      }
      
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
// 生产环境应该在 config.js 中设置 window.API_BASE_URL
if (!window.API_BASE_URL) {
  window.API_BASE_URL = 'http://localhost:3000/api';
}
const apiClient = new APIClient(window.API_BASE_URL);

// 自动初始化（获取 CSRF Token）
apiClient.init().catch(error => {
  console.warn('API Client 自动初始化失败，将在首次请求时重试:', error.message);
});

// 导出单例
window.apiClient = apiClient;

// ES 模块导出
export { APIClient };
export default apiClient;

// 监听认证过期事件
window.addEventListener('auth:expired', () => {
  // 清除用户信息
  localStorage.removeItem('userInfo');
  
  // 如果不在首页或登录页，跳转到首页
  const currentPath = window.location.pathname;
  if (!currentPath.includes('index.html') && currentPath !== '/') {
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 1500);
  }
});
