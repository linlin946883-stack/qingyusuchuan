#!/usr/bin/env node

/**
 * 生产环境诊断工具
 * 检查配置、网络连接和常见问题
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('================================');
console.log('  生产环境诊断工具');
console.log('================================\n');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function success(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function error(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function warning(msg) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

function info(msg) {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

// 检查环境变量文件
function checkEnvFile() {
  console.log('\n[1] 检查环境变量配置');
  console.log('─────────────────────');
  
  const envPath = path.join(__dirname, '.env');
  
  if (fs.existsSync(envPath)) {
    success('.env 文件存在');
    
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    
    // 检查关键配置
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET', 'PORT'];
    const optionalVars = ['WECHAT_APPID', 'WECHAT_MCHID', 'REDIS_HOST'];
    
    requiredVars.forEach(varName => {
      const found = lines.some(line => line.startsWith(`${varName}=`) && !line.includes('your_'));
      if (found) {
        success(`${varName} 已配置`);
      } else {
        error(`${varName} 未配置或使用默认值`);
      }
    });
    
    optionalVars.forEach(varName => {
      const found = lines.some(line => line.startsWith(`${varName}=`) && !line.includes('your_'));
      if (found) {
        info(`${varName} 已配置 (可选)`);
      }
    });
    
  } else {
    error('.env 文件不存在');
    warning('请复制 .env.example 并配置环境变量');
  }
}

// 检查数据库连接
async function checkDatabase() {
  console.log('\n[2] 检查数据库连接');
  console.log('─────────────────────');
  
  require('dotenv').config();
  const mysql = require('mysql2/promise');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'qingyusuchuan'
    });
    
    success(`数据库连接成功: ${process.env.DB_NAME}`);
    
    // 检查表
    const [tables] = await connection.execute('SHOW TABLES');
    if (tables.length > 0) {
      success(`数据库包含 ${tables.length} 个表`);
    } else {
      warning('数据库为空，请运行: npm run migrate');
    }
    
    await connection.end();
    
  } catch (err) {
    error(`数据库连接失败: ${err.message}`);
    warning('请检查 DB_HOST, DB_USER, DB_PASSWORD, DB_NAME 配置');
  }
}

// 检查Redis连接（可选）
async function checkRedis() {
  console.log('\n[3] 检查Redis连接（可选）');
  console.log('─────────────────────');
  
  const redisHost = process.env.REDIS_HOST;
  
  if (!redisHost) {
    info('未配置Redis，将使用内存存储');
    return;
  }
  
  try {
    const { createClient } = require('redis');
    const client = createClient({
      socket: {
        host: redisHost,
        port: process.env.REDIS_PORT || 6379
      },
      password: process.env.REDIS_PASSWORD
    });
    
    await client.connect();
    await client.ping();
    success('Redis连接成功');
    await client.disconnect();
    
  } catch (err) {
    warning(`Redis连接失败: ${err.message}`);
    info('应用将使用内存存储');
  }
}

// 检查CORS配置
function checkCORS() {
  console.log('\n[4] 检查CORS配置');
  console.log('─────────────────────');
  
  const serverPath = path.join(__dirname, 'server.js');
  if (fs.existsSync(serverPath)) {
    const serverContent = fs.readFileSync(serverPath, 'utf-8');
    
    const domains = ['i.lov2u.cn', 'min.lov2u.cn', 'lov2u.cn'];
    domains.forEach(domain => {
      if (serverContent.includes(domain)) {
        success(`${domain} 已在CORS允许列表中`);
      } else {
        warning(`${domain} 未在CORS允许列表中`);
      }
    });
    
  } else {
    error('找不到 server.js 文件');
  }
}

// 检查端口占用
function checkPort() {
  console.log('\n[5] 检查端口状态');
  console.log('─────────────────────');
  
  const port = process.env.PORT || 3000;
  const net = require('net');
  
  const server = net.createServer();
  
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      warning(`端口 ${port} 已被占用`);
      info('如果是当前应用正在运行，这是正常的');
    } else {
      error(`端口检查失败: ${err.message}`);
    }
    server.close();
  });
  
  server.once('listening', () => {
    success(`端口 ${port} 可用`);
    server.close();
  });
  
  server.listen(port);
}

// 检查API端点（如果服务正在运行）
async function checkAPIEndpoints() {
  console.log('\n[6] 检查API端点');
  console.log('─────────────────────');
  
  const port = process.env.PORT || 3000;
  const protocol = http;
  
  return new Promise((resolve) => {
    const req = protocol.get(`http://localhost:${port}/health`, (res) => {
      if (res.statusCode === 200) {
        success('健康检查端点可访问');
        
        // 测试CSRF端点
        http.get(`http://localhost:${port}/api/csrf-token`, (res2) => {
          if (res2.statusCode === 200) {
            success('CSRF Token端点可访问');
          } else {
            warning(`CSRF Token端点返回: ${res2.statusCode}`);
          }
          resolve();
        }).on('error', () => {
          warning('CSRF Token端点不可访问');
          resolve();
        });
        
      } else {
        warning(`健康检查端点返回: ${res.statusCode}`);
        resolve();
      }
    });
    
    req.on('error', () => {
      info('API服务未运行或不可访问');
      info('如需测试，请先运行: npm start 或 pm2 start server.js');
      resolve();
    });
  });
}

// 检查文件权限
function checkPermissions() {
  console.log('\n[7] 检查文件权限');
  console.log('─────────────────────');
  
  const criticalPaths = [
    '.env',
    'config/apiclient_key.pem',
    'config/apiclient_cert.pem'
  ];
  
  criticalPaths.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.accessSync(fullPath, fs.constants.R_OK);
        success(`${filePath} 可读`);
        
        // 检查敏感文件权限
        if (filePath.includes('.pem') || filePath === '.env') {
          const stats = fs.statSync(fullPath);
          const mode = (stats.mode & parseInt('777', 8)).toString(8);
          if (mode === '600' || mode === '400') {
            success(`${filePath} 权限安全 (${mode})`);
          } else {
            warning(`${filePath} 权限过于宽松 (${mode})，建议: chmod 600`);
          }
        }
      } catch (err) {
        error(`${filePath} 无法访问: ${err.message}`);
      }
    } else {
      info(`${filePath} 不存在 (${filePath.includes('.pem') ? '微信支付需要' : '可能需要'})`);
    }
  });
}

// 主函数
async function main() {
  try {
    checkEnvFile();
    await checkDatabase();
    await checkRedis();
    checkCORS();
    checkPort();
    await checkAPIEndpoints();
    checkPermissions();
    
    console.log('\n================================');
    console.log('  诊断完成');
    console.log('================================');
    console.log('\n建议：');
    console.log('1. 修复所有标记为 ✗ 的错误项');
    console.log('2. 检查标记为 ⚠ 的警告项');
    console.log('3. 参考 PRODUCTION_DEPLOY.md 进行部署');
    console.log('4. 使用 pm2 管理生产环境进程\n');
    
  } catch (err) {
    error(`诊断过程出错: ${err.message}`);
    process.exit(1);
  }
}

// 运行诊断
main();
