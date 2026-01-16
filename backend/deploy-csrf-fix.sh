#!/bin/bash

# CSRF 403错误 - 快速修复部署脚本
# 使用方法: chmod +x deploy-csrf-fix.sh && ./deploy-csrf-fix.sh

set -e

echo "================================"
echo "  CSRF 403错误 - 快速修复"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

function success() {
    echo -e "${GREEN}✓${NC} $1"
}

function error() {
    echo -e "${RED}✗${NC} $1"
}

function warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

function info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# 检查是否在backend目录
if [ ! -f "server.js" ]; then
    error "请在backend目录中运行此脚本"
    exit 1
fi

info "步骤 1/5: 检查环境"
echo "─────────────────────"

# 检查Node.js
if command -v node &> /dev/null; then
    success "Node.js 已安装: $(node -v)"
else
    error "Node.js 未安装"
    exit 1
fi

# 检查PM2
if command -v pm2 &> /dev/null; then
    success "PM2 已安装: $(pm2 -v)"
else
    warning "PM2 未安装，将使用 node 直接运行"
fi

echo ""
info "步骤 2/5: 检查Redis（可选）"
echo "─────────────────────"

REDIS_AVAILABLE=false
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        success "Redis 正在运行"
        REDIS_AVAILABLE=true
        
        # 询问是否启用Redis
        read -p "是否启用Redis存储CSRF Token? (推荐) [Y/n]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            # 检查.env文件
            if [ -f ".env" ]; then
                if grep -q "^USE_REDIS=" .env; then
                    sed -i 's/^USE_REDIS=.*/USE_REDIS=true/' .env
                else
                    echo "USE_REDIS=true" >> .env
                fi
                
                if ! grep -q "^REDIS_HOST=" .env; then
                    echo "REDIS_HOST=localhost" >> .env
                fi
                
                if ! grep -q "^REDIS_PORT=" .env; then
                    echo "REDIS_PORT=6379" >> .env
                fi
                
                success "已启用Redis配置"
            else
                warning ".env文件不存在，请手动创建"
            fi
        fi
    else
        warning "Redis 已安装但未运行"
        info "启动Redis: sudo systemctl start redis"
    fi
else
    warning "Redis 未安装"
    info "CSRF Token将使用内存存储（不适合多实例部署）"
fi

echo ""
info "步骤 3/5: 检查代码更新"
echo "─────────────────────"

# 检查关键文件是否存在
if grep -q "redisClient" middleware/security.js 2>/dev/null; then
    success "CSRFProtection 已支持Redis"
else
    error "代码未更新，请先执行: git pull"
    exit 1
fi

echo ""
info "步骤 4/5: 重启应用"
echo "─────────────────────"

# 检查应用是否在运行
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "qingyusuchuan-api"; then
        info "正在重启应用..."
        pm2 restart qingyusuchuan-api
        success "应用已重启"
    else
        info "应用未运行，正在启动..."
        pm2 start server.js --name qingyusuchuan-api
        success "应用已启动"
    fi
else
    warning "未使用PM2，请手动重启应用"
fi

echo ""
info "步骤 5/5: 验证修复"
echo "─────────────────────"

# 等待服务启动
sleep 2

# 测试健康检查
PORT=${PORT:-3000}
if curl -s http://localhost:$PORT/health > /dev/null; then
    success "健康检查端点: OK"
else
    error "健康检查端点: FAIL"
    exit 1
fi

# 测试CSRF Token端点
CSRF_RESPONSE=$(curl -s http://localhost:$PORT/api/csrf-token)
if echo "$CSRF_RESPONSE" | grep -q "csrfToken"; then
    success "CSRF Token端点: OK"
    info "响应: $CSRF_RESPONSE"
else
    error "CSRF Token端点: FAIL"
    error "响应: $CSRF_RESPONSE"
    exit 1
fi

echo ""
echo "================================"
success "修复部署完成！"
echo "================================"
echo ""

info "下一步："
echo "1. 在浏览器访问: https://i.lov2u.cn/csrf-test.html"
echo "2. 运行完整测试"
echo "3. 测试实际功能（发送短信等）"
echo ""

if [ "$REDIS_AVAILABLE" = true ]; then
    info "已启用Redis，CSRF Token将持久化存储"
else
    warning "未启用Redis，服务器重启后Token将失效"
fi

echo ""
info "查看日志: pm2 logs qingyusuchuan-api"
echo ""
