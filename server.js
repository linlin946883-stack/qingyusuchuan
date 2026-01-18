const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const server = http.createServer((req, res) => {
  // 允许跨域请求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 仅使用路径部分，忽略查询参数与哈希
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;
  let filePath = path.join(__dirname, pathname);
  
  // 根据域名返回不同的入口文件
  const host = req.headers.host || '';
  
  if (req.url === '/') {
    // min.lov2u.cn 指向 admin.html
    if (host.includes('min.lov2u.cn')) {
      filePath = path.join(__dirname, 'admin.html');
    }
    // i.lov2u.cn 指向 index.html
    else if (host.includes('i.lov2u.cn')) {
      filePath = path.join(__dirname, 'index.html');
    }
    // 默认 lov2u.cn 指向 qysuc/daohang.html
    else {
      filePath = path.join(__dirname, 'qysuc', 'daohang.html');
    }
  } else if (path.extname(pathname) === '') {
    // 如果没有扩展名，尝试添加.html
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    } else if (!fs.existsSync(filePath)) {
      // 根据域名返回不同的默认页面
      if (host.includes('min.lov2u.cn')) {
        filePath = path.join(__dirname, 'admin.html');
      } else if (host.includes('i.lov2u.cn')) {
        filePath = path.join(__dirname, 'index.html');
      } else {
        filePath = path.join(__dirname, 'qysuc', 'daohang.html');
      }
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('404 - 文件未找到');
      return;
    }

    // 根据文件类型设置Content-Type
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'text/plain; charset=utf-8';
    
    switch(ext) {
      case '.html':
        contentType = 'text/html; charset=utf-8';
        break;
      case '.css':
        contentType = 'text/css; charset=utf-8';
        break;
      case '.js':
        contentType = 'application/javascript; charset=utf-8';
        break;
      case '.json':
        contentType = 'application/json; charset=utf-8';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✓ 前端服务器运行在 http://localhost:${PORT}`);
  console.log(`✓ 后端API: http://localhost:3000/api`);
});
