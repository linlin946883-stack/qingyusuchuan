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
          errorMsg = 'CORS错误：无法连接到API服务器\n原因可能：\n1. API 服务器未运行\n2. API 地址错误\n3. 网络连接问题';
        } else if (response.status === 403) {
          errorMsg = 'CORS 或安全策略错误\n原因可能：\n1. 当前域名未在服务器白名单中\n2. 检查 backend/server.js 中的 allowedOrigins 配置\n3. 确保使用 HTTPS 连接';
        } else if (response.status === 404) {
          errorMsg = 'API 端点不存在\n检查项：\n1. API 地址是否正确\n2. 后端路由是否存在\n3. 后端是否正常运行';
        } else if (response.status === 500) {
          errorMsg = '后端服务器内部错误\n请检查：\n1. 后端日志输出\n2. 数据库连接是否正常\n3. 环境变量配置';
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
        throw new Error('CSRF Token 响应格式错误\n检查项：\n1. 后端 csrf-token 端点是否返回正确格式\n2. 后端日志是否有错误\n3. 数据库连接是否正常');
      }
    } catch (error) {
      console.error('❌ CSRF Token 获取失败:', error.message);
      console.error('');
      console.error('诊断信息：');
      console.error('- API 地址:', this.baseURL);
      console.error('- 当前域名:', window.location.origin);
      console.error('- 浏览器环境:', navigator.userAgent.substring(0, 60) + '...');
      console.error('');
      
      // 如果是网络错误，提供更详细的提示
      if (error.name === 'TypeError') {
        console.error('可能是网络连接问题：');
        console.error('1️⃣  检查 API 服务器是否正在运行');
        console.error('2️⃣  检查 API 地址是否正确（应该是生产环境的完整 URL）');
        console.error('3️⃣  检查防火墙/安全组设置');
        console.error('4️⃣  检查浏览器是否阻止了请求（F12 > Network 标签）');
      }
      
      throw error;
    }
  }

  /**
   * 刷新 CSRF Token
   */
  async refreshCSRFToken() {
    console.log('🔄 开始刷新 CSRF Token...');
    
    // 清除旧token
    this.isInitialized = false;
    this.initPromise = null;
    this.csrfToken = null;
    sessionStorage.removeItem('csrf_token');
    
    try {
      const newToken = await this.init();
      console.log('✓ CSRF Token 刷新成功:', newToken ? newToken.substring(0, 16) + '...' : 'null');
      return newToken;
    } catch (error) {
      console.error('✗ CSRF Token 刷新失败:', error.message);
      throw error;
    }
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
        console.log('✓ 从 sessionStorage 恢复 CSRF Token:', stored.substring(0, 16) + '...');
        return stored;
      }
    }
    
    if (!this.csrfToken) {
      console.warn('⚠ CSRF Token 不可用，需要初始化');
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
        const isRetry = options._retried ? '(重试)' : '';
        console.log(`→ [${method}] ${isRetry} 添加CSRF Token: ${csrfToken.substring(0, 16)}...`);
      } else {
        console.warn(`⚠ [${method}] CSRF Token不可用:`, { 
          hasToken: !!csrfToken, 
          skipCSRF: options.skipCSRF,
          isInitialized: this.isInitialized,
          isRetry: !!options._retried
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

    // 403 错误处理 - 区分 CSRF Token 失效和其他权限问题
    if (response.status === 403) {
      const method = (options.method || 'GET').toUpperCase();
      const errorMessage = data.message || '';
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      // 检查是否是 CSRF Token 相关错误
      const isCSRFError = errorMessage.toLowerCase().includes('csrf') || 
                          errorMessage.toLowerCase().includes('token');
      
      // 检查是否应该重试（未重试过 + 非GET请求 + 是CSRF错误）
      const shouldRetry = !options._retried && 
                          !['GET', 'HEAD', 'OPTIONS'].includes(method) &&
                          isCSRFError;
      
      if (shouldRetry) {
        if (isDev) {
          console.warn('🔄 CSRF Token失效，尝试刷新...', { method, url: options._originalUrl });
        }
        
        try {
          // 刷新 CSRF Token
          await this.refreshCSRFToken();
          if (isDev) console.log('✓ Token已刷新，重试中...');
          
          // 标记为已重试，避免无限循环
          return await this.request(options._originalUrl, {
            ...options,
            _retried: true
          });
        } catch (error) {
          // 静默失败，让上层处理
          if (isDev) console.error('✗ Token刷新失败:', error.message);
          throw new Error('验证失败，请刷新页面重试');
        }
      } else if (options._retried) {
        // 已经重试过但仍然失败 - 静默抛出错误
        if (isDev) console.error('✗ 重试后仍403:', errorMessage);
        throw new Error(errorMessage || '请求被拒绝');
      } else if (!isCSRFError) {
        // 不是CSRF错误，可能是权限或认证问题
        if (isDev) console.error('✗ 403权限错误:', errorMessage);
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
        console.error('API Client 初始化失败:', error);
        console.warn('⚠ 将继续尝试发送请求，但可能会收到 403 错误');
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
      const method = fetchOptions.method || 'GET';
      console.error(`❌ [${method}] 请求失败:`, error.message);
      
      // 提供网络错误的详细信息
      if (error.name === 'TypeError') {
        console.error('');
        console.error('📍 诊断信息：');
        console.error('请求地址:', url);
        console.error('当前域名:', window.location.origin);
        console.error('');
        console.error('可能的原因与解决方案：');
        console.error('1️⃣  CORS 配置错误');
        console.error('   → 检查 backend/server.js 中的 allowedOrigins');
        console.error('   → 确保包含了当前域名: ' + window.location.origin);
        console.error('');
        console.error('2️⃣  API 服务器未运行');
        console.error('   → 确保后端已启动: npm start 或 pm2 start');
        console.error('   → 检查后端日志是否有错误');
        console.error('');
        console.error('3️⃣  网络连接问题');
        console.error('   → 检查 API 服务器是否可达');
        console.error('   → 检查防火墙设置');
        console.error('');
        console.error('4️⃣  API 地址错误');
        console.error('   → 当前 API 地址: ' + window.API_BASE_URL);
        console.error('   → 确认这是正确的生产环境地址');
        console.error('');
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
// 必须先加载 config.js，不应该有默认的 localhost 值
// 如果没有设置则提示错误
if (!window.API_BASE_URL) {
  const errorMsg = '❌ 致命错误：API_BASE_URL 未配置！\n\n原因：\n1. config.js 未正确加载\n2. config.js 中 production 环境配置不完整\n\n解决方案：\n1. 确保 HTML 文件的 <head> 中首先加载: <script src="./js/config.js"></script>\n2. 检查 js/config.js 中是否正确设置了 API_URL\n3. 检查当前域名是否正确识别（开发/生产环境）';
  console.error(errorMsg);
  throw new Error('API_BASE_URL configuration missing');
}

const apiClient = new APIClient(window.API_BASE_URL);

// 打印初始化信息
console.log('');
console.log('═══════════════════════════════════════════');
console.log('🚀 API Client 初始化');
console.log('───────────────────────────────────────────');
console.log('✓ API 基础地址:', window.API_BASE_URL);
console.log('✓ 当前环境:', window.CURRENT_ENV || 'unknown');
console.log('✓ 前端地址:', window.location.origin);
console.log('═══════════════════════════════════════════');
console.log('');

// 自动初始化（获取 CSRF Token）
apiClient.init().catch(error => {
  console.warn('⚠️  API Client 初始化失败 - 将在首次请求时重试');
  console.warn('详情:', error.message);
  console.warn('API 地址:', window.API_BASE_URL);
  console.warn('前端地址:', window.location.origin);
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

/**
 * 全局诊断函数 - 在浏览器控制台输入 diagnoseAPI() 可查看诊断信息
 */
window.diagnoseAPI = function() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('🔍 API 诊断信息');
  console.log('═══════════════════════════════════════════');
  console.log('');
  
  // 配置信息
  console.log('📋 配置信息：');
  console.log('  - API 地址:', window.API_BASE_URL);
  console.log('  - 前端地址:', window.location.origin);
  console.log('  - 当前环境:', window.CURRENT_ENV || '未知');
  console.log('');
  
  // API Client 状态
  console.log('🔗 API Client 状态：');
  console.log('  - 已初始化:', apiClient.isInitialized);
  console.log('  - CSRF Token:', apiClient.csrfToken ? apiClient.csrfToken.substring(0, 16) + '...' : '未获取');
  console.log('  - Auth Token:', apiClient.authToken ? '已设置' : '未设置');
  console.log('');
  
  // 网络信息
  console.log('🌐 网络信息：');
  console.log('  - 用户代理:', navigator.userAgent.substring(0, 60) + '...');
  console.log('  - 在线状态:', navigator.onLine ? '是' : '否');
  console.log('');
  
  // 存储信息
  console.log('💾 本地存储：');
  console.log('  - localStorage 大小:', new Blob(Object.values(localStorage)).size + ' bytes');
  console.log('  - sessionStorage 大小:', new Blob(Object.values(sessionStorage)).size + ' bytes');
  const userInfo = localStorage.getItem('userInfo');
  console.log('  - 用户已登录:', userInfo ? '是' : '否');
  console.log('');
  
  // 测试 API 连接
  console.log('🧪 快速测试：');
  console.log('  执行以下命令测试 API 连接：');
  console.log('  > apiClient.get("/csrf-token").then(r => console.log("✓ 连接正常"))');
  console.log('');
  
  console.log('═══════════════════════════════════════════');
  console.log('');
};

