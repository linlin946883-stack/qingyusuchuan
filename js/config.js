/**
 * 前端配置文件
 * 部署时修改此文件中的 API_URL 即可
 */

// 环境配置
const ENV = {
  // 开发环境配置
  development: {
    API_URL: 'http://localhost:3000/api',
    FRONTEND_URL: 'http://localhost:8000'
  },
  
  // 生产环境配置
  production: {
    API_URL: 'https://lov2u.cn/api',  // 修改为你的后端地址
    FRONTEND_URL: 'https://lov2u.cn'         // 修改为你的前端地址
  },
};

// 自动检测环境（基于域名）
function detectEnvironment() {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  } else if (hostname.includes('staging') || hostname.includes('test')) {
    return 'staging';
  } else {
    return 'production';
  }
}

// 获取当前环境
const currentEnv = window.APP_ENV || detectEnvironment();

// 导出配置
const config = ENV[currentEnv];

// 设置全局变量
window.API_BASE_URL = config.API_URL;
window.FRONTEND_URL = config.FRONTEND_URL;
window.CURRENT_ENV = currentEnv;

console.log(`✓ 环境: ${currentEnv}`);
console.log(`✓ API 地址: ${config.API_URL}`);
