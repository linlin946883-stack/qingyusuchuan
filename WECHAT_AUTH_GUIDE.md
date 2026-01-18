# 微信网页授权使用指南

## 一、什么是微信网页授权？

微信网页授权允许用户在微信内置浏览器中访问你的网页时，获取用户的 `openid` 或用户信息（昵称、头像等）。

## 二、两种授权方式对比

| 参数 | snsapi_base | snsapi_userinfo |
|------|-------------|-----------------|
| **用户体验** | 静默授权，不弹窗 | 需要用户手动确认授权 |
| **获取信息** | 只能获取 openid | 可获取昵称、头像、性别、地区 |
| **是否需要关注** | 否 | 否 |
| **使用场景** | 仅需要识别用户身份 | 需要展示用户信息 |

## 三、配置要求

### 1. 微信公众平台配置

登录 [微信公众平台](https://mp.weixin.qq.com)：

1. 进入 **设置与开发 → 账号设置 → 功能设置**
2. 找到 **网页授权域名**
3. 配置域名：`i.lov2u.cn`（不要加 http:// 和端口号）

### 2. 环境变量配置

在 `backend/.env` 文件中配置：

```env
# 微信公众号配置
WECHAT_APPID=你的公众号appid
WECHAT_APP_SECRET=你的公众号密钥
```

## 四、URL 构成详解

### 完整 URL 格式：

```
https://open.weixin.qq.com/connect/oauth2/authorize
  ?appid=APPID
  &redirect_uri=REDIRECT_URI
  &response_type=code
  &scope=SCOPE
  &state=STATE
  #wechat_redirect
```

### 参数说明：

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| **appid** | 是 | 公众号的唯一标识 | `wx520c15f417810387` |
| **redirect_uri** | 是 | 授权后回调地址，需要 URL encode | `https%3A%2F%2Fi.lov2u.cn%2Fapi%2Fauth%2Fwechat%2Fcallback` |
| **response_type** | 是 | 固定值 | `code` |
| **scope** | 是 | 授权作用域 | `snsapi_base` 或 `snsapi_userinfo` |
| **state** | 否 | 自定义参数，回调时会原样返回 | `123` 或 `/pages/my.html` |
| **#wechat_redirect** | 是 | 固定后缀 | `#wechat_redirect` |

## 五、Node.js 中如何拼接 URL？

### 方法一：使用后端 API（推荐）✅

**前端调用：**

```javascript
// 1. 基础授权（只获取 openid）
wechatAuth('snsapi_base', '/pages/my.html');

// 2. 获取用户信息授权
wechatAuth('snsapi_userinfo', '/pages/my.html');
```

**后端已实现：**

```javascript
// GET /api/auth/wechat/auth-url
// 查询参数：
// - scope: snsapi_base 或 snsapi_userinfo
// - redirectPath: 授权成功后跳转的页面
// - state: 自定义参数

// 返回格式：
{
  "code": 0,
  "data": {
    "authUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=..."
  }
}
```

### 方法二：直接在前端构建 URL

```javascript
const appid = 'wx520c15f417810387';
const redirectUri = 'https://i.lov2u.cn/api/auth/wechat/callback';
const scope = 'snsapi_base';
const state = '/pages/my.html';

// 使用 buildWeChatAuthUrl 函数
const authUrl = buildWeChatAuthUrl(appid, redirectUri, scope, state);
window.location.href = authUrl;
```

### 方法三：纯 JavaScript 拼接

```javascript
const params = {
  appid: 'wx520c15f417810387',
  redirect_uri: encodeURIComponent('https://i.lov2u.cn/api/auth/wechat/callback'),
  response_type: 'code',
  scope: 'snsapi_base',
  state: encodeURIComponent('/pages/my.html')
};

const authUrl = 
  `https://open.weixin.qq.com/connect/oauth2/authorize` +
  `?appid=${params.appid}` +
  `&redirect_uri=${params.redirect_uri}` +
  `&response_type=${params.response_type}` +
  `&scope=${params.scope}` +
  `&state=${params.state}` +
  `#wechat_redirect`;

// 跳转到授权页面
window.location.href = authUrl;
```

### 方法四：使用 URLSearchParams（最规范）

```javascript
const baseUrl = 'https://open.weixin.qq.com/connect/oauth2/authorize';
const params = new URLSearchParams({
  appid: 'wx520c15f417810387',
  redirect_uri: 'https://i.lov2u.cn/api/auth/wechat/callback',
  response_type: 'code',
  scope: 'snsapi_base',
  state: '/pages/my.html'
});

const authUrl = `${baseUrl}?${params.toString()}#wechat_redirect`;
window.location.href = authUrl;
```

## 六、完整授权流程

```
用户访问页面
    ↓
检测是否已登录
    ↓ (未登录)
调用 wechatAuth()
    ↓
跳转到微信授权页面
    ↓
用户授权（snsapi_userinfo）或自动授权（snsapi_base）
    ↓
微信回调到 /api/auth/wechat/callback?code=xxx&state=yyy
    ↓
后端通过 code 换取 access_token 和 openid
    ↓
后端自动注册/登录用户，生成 JWT token
    ↓
重定向到 state 指定的页面，URL 带上 token 参数
    ↓
前端调用 getTokenFromUrl() 保存 token
    ↓
完成登录，可以调用需要授权的 API
```

## 七、实际使用示例

### 示例 1：登录页面自动授权

```javascript
// pages/login.html 或在需要登录的页面

// 页面加载时检查登录状态
window.addEventListener('DOMContentLoaded', () => {
  // 先检查 URL 中是否有 token（从微信授权回调过来）
  const authResult = getTokenFromUrl();
  
  if (authResult) {
    // 授权成功，已保存 token
    showToast('登录成功');
    // 可以跳转到其他页面或刷新用户信息
    window.location.href = '/pages/my.html';
    return;
  }
  
  // 检查是否已经有 token
  if (hasToken()) {
    // 已登录
    return;
  }
  
  // 未登录且在微信浏览器中，发起授权
  if (isWeChatBrowser()) {
    // 使用 snsapi_base 静默授权
    wechatAuth('snsapi_base', window.location.pathname);
  } else {
    // 非微信浏览器，显示其他登录方式
    showToast('请在微信中打开');
  }
});
```

### 示例 2：个人中心页面获取用户信息

```javascript
// pages/my.html

async function loadUserInfo() {
  // 检查是否有授权回调的 token
  getTokenFromUrl();
  
  if (!hasToken()) {
    // 使用 snsapi_userinfo 获取用户信息
    wechatAuth('snsapi_userinfo', '/pages/my.html');
    return;
  }
  
  // 已登录，获取用户信息
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/users/me`, {
      headers: getAuthHeaders()
    });
    const result = await response.json();
    
    if (result.code === 0) {
      // 显示用户信息
      document.getElementById('nickname').textContent = result.data.nickname;
      document.getElementById('avatar').src = result.data.avatar;
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
}

// 页面加载时
window.addEventListener('DOMContentLoaded', loadUserInfo);
```

### 示例 3：按钮点击授权

```html
<button onclick="handleWeChatLogin()">微信登录</button>

<script>
function handleWeChatLogin() {
  if (!isWeChatBrowser()) {
    showToast('请在微信中打开');
    return;
  }
  
  // 点击按钮后跳转授权，授权成功后回到当前页
  wechatAuth('snsapi_userinfo', window.location.pathname);
}
</script>
```

## 八、常见问题

### 1. redirect_uri 参数错误

**原因：** 回调地址的域名未在微信公众平台配置

**解决：**
- 确保在微信公众平台配置了 `i.lov2u.cn`
- 检查 redirect_uri 是否使用了 `encodeURIComponent()` 进行编码

### 2. 授权后无法获取用户信息

**原因：** 使用了 `snsapi_base` 作用域

**解决：** 改用 `snsapi_userinfo` 作用域

### 3. 非微信浏览器访问报错

**解决：** 在调用授权前检查是否在微信浏览器中

```javascript
if (!isWeChatBrowser()) {
  showToast('请在微信中打开');
  return;
}
```

### 4. state 参数丢失

**原因：** state 参数未进行 URL 编码

**解决：** 使用 `encodeURIComponent()` 编码特殊字符

```javascript
state: encodeURIComponent('/pages/my.html?tab=orders')
```

## 九、安全建议

1. **不要在前端暴露 app_secret**，所有需要 secret 的操作必须在后端完成
2. **使用 HTTPS** 协议，确保通信安全
3. **验证 state 参数**，防止 CSRF 攻击
4. **Token 存储在 localStorage**，并设置合理的过期时间
5. **回调地址必须是服务器端路由**，不要直接是静态 HTML 页面

## 十、测试清单

- [ ] 微信公众平台已配置网页授权域名 `i.lov2u.cn`
- [ ] 后端 `.env` 文件已配置 `WECHAT_APPID` 和 `WECHAT_APP_SECRET`
- [ ] 在微信开发者工具或真实微信中测试授权流程
- [ ] 测试 `snsapi_base` 和 `snsapi_userinfo` 两种授权方式
- [ ] 检查授权回调后 token 是否正确保存
- [ ] 验证授权后能否正常调用需要登录的 API

---

**提示：** 已经在项目中实现了完整的微信网页授权功能，直接使用 `wechatAuth()` 函数即可！
