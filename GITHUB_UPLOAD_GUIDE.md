# 📦 GitHub 上传指南

本指南将帮助您将"轻羽速传"项目上传到 GitHub。

## 🎯 前置准备

### 1. 确认 Git 已安装
✅ 已检测到 Git 版本: 2.52.0

### 2. 确认 GitHub 账号
- 如果还没有 GitHub 账号，请前往 https://github.com 注册
- 登录您的 GitHub 账号

---

## 📝 步骤一：在 GitHub 创建新仓库

1. 访问 https://github.com/new
2. 填写仓库信息：
   - **Repository name**: `qingyusuchuan` (或您喜欢的名字)
   - **Description**: 轻羽速传 - 情感传递服务平台
   - **可见性**: 选择 Public(公开) 或 Private(私有)
   - ⚠️ **不要勾选** "Initialize this repository with a README"
   - ⚠️ **不要** 添加 .gitignore 或 license (我们已经有了)
3. 点击 "Create repository" 按钮
4. **记下仓库地址**，格式类似：`https://github.com/你的用户名/qingyusuchuan.git`

---

## 🚀 步骤二：初始化本地 Git 仓库

在项目根目录打开 PowerShell 或命令行，执行以下命令：

### 1. 初始化 Git 仓库
```powershell
cd d:\qingyusuchuan
git init
```

### 2. 配置 Git 用户信息（首次使用需要）
```powershell
git config --global user.name "你的名字"
git config --global user.email "your-email@example.com"
```

### 3. 添加所有文件到暂存区
```powershell
git add .
```

### 4. 检查哪些文件将被提交
```powershell
git status
```

你应该看到绿色的文件列表，被 .gitignore 排除的文件不会显示（如 node_modules/）

### 5. 提交到本地仓库
```powershell
git commit -m "Initial commit: 轻羽速传项目初始化"
```

---

## 📤 步骤三：推送到 GitHub

### 1. 关联远程仓库
将 `你的用户名` 替换为您的 GitHub 用户名：
```powershell
git remote add origin https://github.com/你的用户名/qingyusuchuan.git
```

### 2. 推送代码到 GitHub
```powershell
# 首次推送
git push -u origin master
```

或者如果使用 main 分支：
```powershell
git branch -M main
git push -u origin main
```

### 3. 输入 GitHub 凭据
- 第一次推送时，系统会要求输入 GitHub 用户名和密码
- ⚠️ **注意**: GitHub 已不再支持密码认证，需要使用 Personal Access Token (PAT)

---

## 🔑 如何获取 GitHub Personal Access Token (PAT)

如果推送时提示需要 token：

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" → "Generate new token (classic)"
3. 填写信息：
   - **Note**: `qingyusuchuan-upload`
   - **Expiration**: 选择过期时间（建议 90 days）
   - **Select scopes**: 勾选 `repo` (完整仓库访问权限)
4. 点击 "Generate token"
5. **立即复制 token**（只显示一次！）
6. 推送时使用 token 作为密码

---

## 📋 完整命令清单（复制粘贴版）

```powershell
# 1. 进入项目目录
cd d:\qingyusuchuan

# 2. 初始化 Git
git init

# 3. 配置用户信息（替换为您的信息）
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# 4. 添加所有文件
git add .

# 5. 查看状态
git status

# 6. 提交到本地仓库
git commit -m "Initial commit: 轻羽速传项目初始化"

# 7. 关联远程仓库（替换为您的 GitHub 地址）
git remote add origin https://github.com/你的用户名/qingyusuchuan.git

# 8. 推送到 GitHub
git branch -M main
git push -u origin main
```

---

## 🔄 后续更新代码

完成首次上传后，以后更新代码使用：

```powershell
# 1. 添加修改的文件
git add .

# 2. 提交修改
git commit -m "描述你的修改内容"

# 3. 推送到 GitHub
git push
```

---

## ⚠️ 重要安全提示

### 在上传前务必确认：

✅ **已检查**: `.env` 文件已在 `.gitignore` 中排除  
✅ **已检查**: `node_modules/` 已被排除  
✅ **已检查**: 日志文件已被排除

### 🔒 保护敏感信息

上传前请确认 `.env` 文件中的敏感信息：
- ❌ 数据库密码
- ❌ JWT 密钥
- ❌ API 密钥

这些信息**绝不**应该上传到 GitHub！

---

## 🎨 美化 GitHub 仓库（可选）

### 1. 添加仓库标签
在 GitHub 仓库页面点击 "Add topics"，添加标签：
- `nodejs`
- `express`
- `mysql`
- `full-stack`
- `emotion-delivery`

### 2. 设置仓库描述
在 "About" 部分点击设置图标，填写：
- **Description**: 轻羽速传 - 帮你说出心里话，让关系重新连接
- **Website**: 如果有线上地址可以填写

### 3. 添加 LICENSE
如果是开源项目，可以添加开源许可证：
```powershell
# 在 GitHub 仓库页面点击 "Add file" → "Create new file"
# 文件名输入: LICENSE
# 然后选择一个许可证模板（如 MIT License）
```

---

## 📱 验证上传成功

完成推送后：

1. 访问您的 GitHub 仓库地址
2. 应该能看到所有项目文件
3. README.md 会自动显示在仓库主页

---

## 🐛 常见问题

### 问题 1: 推送失败 "fatal: Authentication failed"
**解决方案**: 使用 Personal Access Token 代替密码

### 问题 2: "failed to push some refs"
**解决方案**: 
```powershell
git pull origin main --rebase
git push origin main
```

### 问题 3: 文件太大无法推送
**解决方案**: 检查是否误上传了 `node_modules/` 或大文件

### 问题 4: 中文文件名乱码
**解决方案**:
```powershell
git config --global core.quotepath false
```

### 问题 5: 想要使用 SSH 而不是 HTTPS
**解决方案**:
```powershell
# 1. 生成 SSH 密钥
ssh-keygen -t ed25519 -C "your-email@example.com"

# 2. 添加公钥到 GitHub (https://github.com/settings/keys)
# 3. 更改远程地址
git remote set-url origin git@github.com:你的用户名/qingyusuchuan.git
```

---

## 📚 推荐的 Git 分支管理

建议采用以下分支策略：

- `main` (主分支) - 生产环境代码
- `develop` (开发分支) - 开发环境代码
- `feature/*` (功能分支) - 新功能开发
- `hotfix/*` (修复分支) - 紧急修复

---

## 🎉 完成！

恭喜！您的项目现在已经托管在 GitHub 上了。

**仓库地址**: `https://github.com/你的用户名/qingyusuchuan`

可以与团队成员分享这个地址，他们可以通过以下命令克隆项目：

```powershell
git clone https://github.com/你的用户名/qingyusuchuan.git
```

---

## 📞 需要帮助？

- Git 官方文档: https://git-scm.com/doc
- GitHub 指南: https://docs.github.com/cn
- Git 教程: https://www.liaoxuefeng.com/wiki/896043488029600

---

**文档创建时间**: 2025年12月9日
