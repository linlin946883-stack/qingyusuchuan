# GitHub 快速上传脚本
# 使用前请先修改下面的用户信息和仓库地址

# ==================== 配置区 ====================
# 请修改为您的信息
$GIT_USER_NAME = "Your Name"              # 修改为您的名字
$GIT_USER_EMAIL = "your-email@example.com" # 修改为您的邮箱
$GITHUB_USERNAME = "your-username"         # 修改为您的GitHub用户名
$REPO_NAME = "qingyusuchuan"               # 仓库名称（可修改）

# ==================== 执行区 ====================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   轻羽速传 - GitHub 上传工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否修改了配置
if ($GIT_USER_NAME -eq "Your Name" -or $GIT_USER_EMAIL -eq "your-email@example.com") {
    Write-Host "⚠️  请先修改脚本中的用户信息！" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "打开脚本文件编辑以下内容：" -ForegroundColor Yellow
    Write-Host "  GIT_USER_NAME    = 您的名字" -ForegroundColor Gray
    Write-Host "  GIT_USER_EMAIL   = 您的邮箱" -ForegroundColor Gray
    Write-Host "  GITHUB_USERNAME  = 您的GitHub用户名" -ForegroundColor Gray
    Write-Host ""
    exit
}

# 1. 配置Git用户信息
Write-Host "📝 步骤 1: 配置Git用户信息..." -ForegroundColor Green
git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"
Write-Host "   ✓ 用户名: $GIT_USER_NAME" -ForegroundColor Gray
Write-Host "   ✓ 邮箱: $GIT_USER_EMAIL" -ForegroundColor Gray
Write-Host ""

# 2. 检查Git状态
Write-Host "📋 步骤 2: 检查文件状态..." -ForegroundColor Green
$status = git status --short
if ($status) {
    Write-Host "   ✓ 发现待提交文件" -ForegroundColor Gray
} else {
    Write-Host "   ✓ 所有文件已暂存" -ForegroundColor Gray
}
Write-Host ""

# 3. 创建提交
Write-Host "💾 步骤 3: 创建本地提交..." -ForegroundColor Green
git commit -m "Initial commit: 轻羽速传项目初始化

- 完整的前后端分离架构
- 用户认证系统（JWT）
- 订单管理系统
- 支付充值系统
- 敏感词检测（UAPI）
- 管理后台
- 安全防护机制
- 完整的项目文档"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ 提交成功" -ForegroundColor Gray
} else {
    Write-Host "   ✗ 提交失败" -ForegroundColor Red
    exit
}
Write-Host ""

# 4. 关联远程仓库
Write-Host "🔗 步骤 4: 关联GitHub仓库..." -ForegroundColor Green
$remoteUrl = "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"

# 检查是否已有远程仓库
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "   ⚠️  远程仓库已存在: $existingRemote" -ForegroundColor Yellow
    $confirm = Read-Host "   是否要更新为新地址？(y/n)"
    if ($confirm -eq "y") {
        git remote set-url origin $remoteUrl
        Write-Host "   ✓ 已更新远程仓库地址" -ForegroundColor Gray
    }
} else {
    git remote add origin $remoteUrl
    Write-Host "   ✓ 已关联远程仓库" -ForegroundColor Gray
}
Write-Host "   仓库地址: $remoteUrl" -ForegroundColor Gray
Write-Host ""

# 5. 推送到GitHub
Write-Host "🚀 步骤 5: 推送到GitHub..." -ForegroundColor Green
Write-Host "   注意：首次推送需要输入GitHub凭据" -ForegroundColor Yellow
Write-Host "   如果提示需要密码，请使用Personal Access Token" -ForegroundColor Yellow
Write-Host ""

# 创建main分支并推送
git branch -M main
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   ✓ 上传成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "您的仓库地址：" -ForegroundColor Cyan
    Write-Host "   $remoteUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "GitHub页面：" -ForegroundColor Cyan
    Write-Host "   https://github.com/$GITHUB_USERNAME/$REPO_NAME" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "   ✗ 推送失败" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "常见问题：" -ForegroundColor Yellow
    Write-Host "1. 认证失败 - 请使用Personal Access Token代替密码" -ForegroundColor Gray
    Write-Host "2. 仓库不存在 - 请先在GitHub创建仓库" -ForegroundColor Gray
    Write-Host "3. 网络问题 - 请检查网络连接" -ForegroundColor Gray
    Write-Host ""
    Write-Host "获取Token: https://github.com/settings/tokens" -ForegroundColor Cyan
    Write-Host "详细文档: 查看 GITHUB_UPLOAD_GUIDE.md" -ForegroundColor Cyan
    Write-Host ""
}
