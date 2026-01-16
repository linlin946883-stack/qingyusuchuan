# CSRF 403错误 - 快速修复部署脚本 (PowerShell)
# 使用方法: .\deploy-csrf-fix.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  CSRF 403错误 - 快速修复" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

# 检查是否在backend目录
if (!(Test-Path "server.js")) {
    Write-Error-Custom "请在backend目录中运行此脚本"
    exit 1
}

Write-Info "步骤 1/5: 检查环境"
Write-Host "─────────────────────"

# 检查Node.js
try {
    $nodeVersion = node --version
    Write-Success "Node.js 已安装: $nodeVersion"
} catch {
    Write-Error-Custom "Node.js 未安装"
    exit 1
}

# 检查PM2
try {
    $pm2Version = pm2 --version
    Write-Success "PM2 已安装: $pm2Version"
    $usePM2 = $true
} catch {
    Write-Warning-Custom "PM2 未安装，将使用 node 直接运行"
    $usePM2 = $false
}

Write-Host ""
Write-Info "步骤 2/5: 检查代码更新"
Write-Host "─────────────────────"

# 检查关键文件是否存在
$securityFile = "middleware\security.js"
if (Test-Path $securityFile) {
    $content = Get-Content $securityFile -Raw
    if ($content -match "redisClient") {
        Write-Success "CSRFProtection 已支持Redis"
    } else {
        Write-Error-Custom "代码未更新，请先执行: git pull"
        exit 1
    }
} else {
    Write-Error-Custom "找不到 $securityFile"
    exit 1
}

Write-Host ""
Write-Info "步骤 3/5: 检查.env配置"
Write-Host "─────────────────────"

if (Test-Path ".env") {
    Write-Success ".env 文件存在"
    
    $envContent = Get-Content ".env" -Raw
    
    # 检查关键配置
    $requiredVars = @("DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET")
    foreach ($var in $requiredVars) {
        if ($envContent -match "^$var=") {
            Write-Success "$var 已配置"
        } else {
            Write-Warning-Custom "$var 未配置"
        }
    }
} else {
    Write-Warning-Custom ".env 文件不存在"
    Write-Info "请复制 .env.example 并配置"
}

Write-Host ""
Write-Info "步骤 4/5: 重启应用"
Write-Host "─────────────────────"

if ($usePM2) {
    $pm2List = pm2 list 2>&1
    if ($pm2List -match "qingyusuchuan-api") {
        Write-Info "正在重启应用..."
        pm2 restart qingyusuchuan-api
        Write-Success "应用已重启"
    } else {
        Write-Info "应用未运行，正在启动..."
        pm2 start server.js --name qingyusuchuan-api
        Write-Success "应用已启动"
    }
} else {
    Write-Warning-Custom "未使用PM2，请手动重启应用"
    Write-Info "启动命令: node server.js"
}

Write-Host ""
Write-Info "步骤 5/5: 验证修复"
Write-Host "─────────────────────"

# 等待服务启动
Start-Sleep -Seconds 2

# 读取端口配置
$port = 3000
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^PORT=(\d+)") {
            $port = $matches[1]
        }
    }
}

# 测试健康检查
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:$port/health" -UseBasicParsing -ErrorAction Stop
    Write-Success "健康检查端点: OK"
} catch {
    Write-Error-Custom "健康检查端点: FAIL"
    Write-Error-Custom $_.Exception.Message
    exit 1
}

# 测试CSRF Token端点
try {
    $csrfResponse = Invoke-WebRequest -Uri "http://localhost:$port/api/csrf-token" -UseBasicParsing -ErrorAction Stop
    $csrfData = $csrfResponse.Content | ConvertFrom-Json
    
    if ($csrfData.data.csrfToken) {
        Write-Success "CSRF Token端点: OK"
        Write-Info "Token: $($csrfData.data.csrfToken.Substring(0, 16))..."
    } else {
        Write-Error-Custom "CSRF Token格式错误"
    }
} catch {
    Write-Error-Custom "CSRF Token端点: FAIL"
    Write-Error-Custom $_.Exception.Message
    exit 1
}

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Success "修复部署完成！"
Write-Host "================================" -ForegroundColor Green
Write-Host ""

Write-Info "下一步："
Write-Host "1. 在浏览器访问: https://i.lov2u.cn/csrf-test.html"
Write-Host "2. 运行完整测试"
Write-Host "3. 测试实际功能（发送短信等）"
Write-Host ""

Write-Info "查看日志: pm2 logs qingyusuchuan-api"
Write-Host ""

# 提供浏览器测试脚本
Write-Host "浏览器控制台测试脚本:" -ForegroundColor Yellow
Write-Host @"
// 清除旧token并测试
sessionStorage.clear();
fetch(`${API_BASE_URL}/csrf-token`, { credentials: 'include' })
  .then(r => r.json())
  .then(d => {
    console.log('✓ Token获取成功:', d);
    sessionStorage.setItem('csrf_token', d.data.csrfToken);
  })
  .catch(e => console.error('✗ 失败:', e));
"@ -ForegroundColor Gray
Write-Host ""
