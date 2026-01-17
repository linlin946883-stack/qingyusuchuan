document.addEventListener('DOMContentLoaded', () => {
  // 手机号检查表单
  const phoneCheckForm = document.getElementById('phoneCheckForm');
  const phoneInput = document.getElementById('phoneInput');
  const phoneError = document.getElementById('phoneError');
  const phoneCheckBtn = document.getElementById('phoneCheckBtn');

  // 登录表单
  const loginForm = document.getElementById('loginForm');
  const loginPhoneInput = document.getElementById('loginPhoneInput');
  const loginPhoneError = document.getElementById('loginPhoneError');
  const loginPassword = document.getElementById('loginPassword');
  const loginPasswordError = document.getElementById('loginPasswordError');
  const loginBtn = document.getElementById('loginBtn');

  // 注册表单
  const registerForm = document.getElementById('registerForm');
  const registerPhoneInput = document.getElementById('registerPhoneInput');
  const registerPhoneError = document.getElementById('registerPhoneError');
  const registerVerifyCode = document.getElementById('registerVerifyCode');
  const getVerifyCodeBtn = document.getElementById('getVerifyCodeBtn');
  const registerPassword = document.getElementById('registerPassword');
  const registerPasswordError = document.getElementById('registerPasswordError');
  const registerBtn = document.getElementById('registerBtn');

  const PHONE_REGEX = /^1[3-9]\d{9}$/;
  const VERIFY_CODE_DURATION = 60;
  let checkTimer = null;
  let verifyCodeTimer = null;
  let verifyCodeCountdown = 0;
  const state = {
    mode: null,
    isChecking: false,
    lastPhoneChecked: '',
    lastExistsResult: null,
    currentPhone: ''
  };

  const urlParams = new URLSearchParams(window.location.search);
  const returnUrlParam = urlParams.get('return');

  // 手机号输入事件
  phoneInput.addEventListener('input', () => {
    const sanitized = phoneInput.value.replace(/\D/g, '').slice(0, 11);
    if (phoneInput.value !== sanitized) {
      phoneInput.value = sanitized;
    }
    handlePhoneChange();
  });

  // 手机号检查表单提交
  phoneCheckForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const phone = phoneInput.value;
    if (PHONE_REGEX.test(phone)) {
      triggerPhoneCheckNow(phone);
    }
  });

  // 登录表单提交
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handleLogin();
  });

  // 注册表单提交
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handleRegister();
  });

  getVerifyCodeBtn.addEventListener('click', (event) => {
    event.preventDefault();
    handleGetVerifyCode();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT') {
        event.preventDefault();
        submitAction();
      }
    }
  });

  function handlePhoneChange() {
    const phone = phoneInput.value;
    clearPhoneError();

    if (!phone) {
      resetDynamicFields();
      return;
    }

    if (phone.length < 11) {
      resetDynamicFields();
      return;
    }

    if (!PHONE_REGEX.test(phone)) {
      setPhoneError('手机号格式不正确');
      resetDynamicFields();
      return;
    }

    if (phone === state.lastPhoneChecked && state.mode) {
      // 用户回退到同一号码，不重新请求
      return;
    }

    schedulePhoneCheck(phone);
  }

  function schedulePhoneCheck(phone) {
    if (checkTimer) {
      clearTimeout(checkTimer);
    }
    checkTimer = setTimeout(() => triggerPhoneCheckNow(phone), 400);
  }

  async function triggerPhoneCheckNow(phone) {
    if (!PHONE_REGEX.test(phone) || state.isChecking) {
      return;
    }

    state.isChecking = true;
    setActionState(true, '查询中...');
    resetDynamicFields(false);

    const exists = await checkPhoneExists(phone);
    state.isChecking = false;
    state.lastPhoneChecked = phone;
    state.lastExistsResult = exists;

    if (exists === null) {
      setActionState(true, '稍后再试');
      return;
    }

    if (exists) {
      enterLoginMode();
    } else {
      enterRegisterMode();
    }
  }

  function enterLoginMode() {
    state.mode = 'login';
    state.currentPhone = phoneInput.value;
    
    // 隐藏手机号检查表单，显示登录表单
    phoneCheckForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    
    // 预填手机号
    loginPhoneInput.value = state.currentPhone;
    loginPassword.value = '';
    loginPasswordError.textContent = '';
    loginPhoneError.textContent = '';
  }

  function enterRegisterMode() {
    state.mode = 'register';
    state.currentPhone = phoneInput.value;
    
    // 隐藏手机号检查表单，显示注册表单
    phoneCheckForm.classList.add('hidden');
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    
    // 预填手机号
    registerPhoneInput.value = state.currentPhone;
    resetVerifyCodeState();
    registerVerifyCode.value = '';
    registerPassword.value = '';
    registerPasswordError.textContent = '';
    registerPhoneError.textContent = '';
  }

  function resetDynamicFields(clearMode = true) {
    if (clearMode) {
      state.mode = null;
      state.lastPhoneChecked = '';
      state.lastExistsResult = null;
      state.currentPhone = '';
    }
    
    // 显示手机号检查表单，隐藏其他表单
    phoneCheckForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    setActionState(true, '请输入手机号');
    resetVerifyCodeState();
  }

  function setPhoneError(message) {
    phoneError.textContent = message;
  }

  function clearPhoneError() {
    phoneError.textContent = '';
  }

  function setActionState(disabled, text) {
    phoneCheckBtn.disabled = disabled;
    if (text) {
      phoneCheckBtn.textContent = text;
    }
  }

  function resetVerifyCodeState() {
    if (verifyCodeTimer) {
      clearInterval(verifyCodeTimer);
      verifyCodeTimer = null;
    }
    verifyCodeCountdown = 0;
    getVerifyCodeBtn.disabled = false;
    getVerifyCodeBtn.textContent = '获取验证码';
  }

  async function handleGetVerifyCode() {
    const phone = registerPhoneInput.value.trim();
    
    if (!PHONE_REGEX.test(phone)) {
      registerPhoneError.textContent = '手机号格式不正确';
      return;
    }

    registerPhoneError.textContent = '';

    // 禁用按钮并开始倒计时
    if (verifyCodeTimer) {
      clearInterval(verifyCodeTimer);
    }

    verifyCodeCountdown = VERIFY_CODE_DURATION;
    getVerifyCodeBtn.disabled = true;
    getVerifyCodeBtn.textContent = `发送中...`;

    try {
      // 调用发送验证码 API
      const response = await fetch(`${window.API_BASE_URL}/auth/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone })
      });

      const result = await response.json();

      if (result.code === 0) {
        // 发送成功，开始倒计时
        
        // 开发环境在控制台显示验证码（方便测试）
        if (result.debug_code) {
          console.log(`[开发环境] 验证码: ${result.debug_code}`);
        }

        // 开始倒计时
        getVerifyCodeBtn.textContent = `${verifyCodeCountdown}s`;
        verifyCodeTimer = setInterval(() => {
          verifyCodeCountdown -= 1;
          if (verifyCodeCountdown > 0) {
            getVerifyCodeBtn.textContent = `${verifyCodeCountdown}s`;
            return;
          }

          clearInterval(verifyCodeTimer);
          verifyCodeTimer = null;
          resetVerifyCodeState();
        }, 1000);

      } else {
        // 发送失败
        resetVerifyCodeState();
      }
    } catch (error) {
      resetVerifyCodeState();
    }
  }

  async function handleLogin() {
    const phone = loginPhoneInput.value.trim();
    const password = loginPassword.value.trim();
    loginPasswordError.textContent = '';
    loginPhoneError.textContent = '';

    if (!PHONE_REGEX.test(phone)) {
      loginPhoneError.textContent = '手机号格式不正确';
      return;
    }

    if (!password) {
      loginPasswordError.textContent = '请输入密码';
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';
    
    const result = await userLoginPassword(phone, password);
    
    loginBtn.disabled = false;
    loginBtn.textContent = '登录';

    if (result.code === 0) {
      redirectAfterAuth();
    } else {
      loginPasswordError.textContent = result.message || '登录失败，请重试';
    }
  }

  async function handleRegister() {
    const phone = registerPhoneInput.value.trim();
    const verifyCode = registerVerifyCode.value.trim();
    const password = registerPassword.value.trim();
    let valid = true;

    registerPasswordError.textContent = '';
    registerPhoneError.textContent = '';

    if (!PHONE_REGEX.test(phone)) {
      registerPhoneError.textContent = '手机号格式不正确';
      valid = false;
    }

    if (!verifyCode) {
      valid = false;
    }

    if (!password || password.length < 8) {
      registerPasswordError.textContent = '密码至少8位';
      valid = false;
    }

    if (!valid) {
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = '注册中...';
    
    // 传递验证码参数：userRegister(username, password, phone, verifyCode)
    const result = await userRegister(phone, password, phone, verifyCode);
    
    registerBtn.disabled = false;
    registerBtn.textContent = '注册';

    if (result.code === 0) {
      showToast('注册成功，已自动登录');
      redirectAfterAuth();
    } else {
      registerPasswordError.textContent = result.message || '注册失败，请重试';
    }
  }

  /**
   * URL白名单验证
   * 防止开放重定向攻击
   */
  function isUrlSafe(url) {
    if (!url) return false;
    
    try {
      // 允许的URL模式（白名单）
      const allowedPatterns = [
        // 相对路径
        /^\.\.\/[a-zA-Z0-9_\-\/\.]+\.html$/,
        /^\/[a-zA-Z0-9_\-\/\.]+\.html$/,
        // 站内页面
        /^(pages\/|\.\.\/pages\/)[a-zA-Z0-9_\-]+\.html$/,
        /^[a-zA-Z0-9_\-]+\.html$/,
        // index.html 特殊处理
        /^(\.\.\/)?index\.html$/
      ];
      
      // 检查是否匹配任一白名单模式
      const isPatternMatch = allowedPatterns.some(pattern => pattern.test(url));
      if (isPatternMatch) {
        return true;
      }
      
      // 如果是完整URL，检查域名
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        const currentHost = window.location.host;
        
        // 只允许同域名跳转
        if (urlObj.host === currentHost) {
          // 进一步检查路径是否安全
          const path = urlObj.pathname;
          const safePathPattern = /^\/[a-zA-Z0-9_\-\/\.]*\.html$/;
          return safePathPattern.test(path) || path === '/' || path === '/index.html';
        }
        
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('URL验证失败:', error);
      return false;
    }
  }

  function redirectAfterAuth() {
    let targetUrl = returnUrlParam
      ? decodeURIComponent(returnUrlParam)
      : (document.referrer && !document.referrer.includes('login.html'))
        ? document.referrer
        : '../index.html';

    // URL安全验证
    if (!isUrlSafe(targetUrl)) {
      console.warn('不安全的重定向URL，已重定向到首页:', targetUrl);
      targetUrl = '../index.html';
    }

    setTimeout(() => {
      window.location.replace(targetUrl);
    }, 600);
  }

  window.goBack = function goBack() {
    if (document.referrer && isUrlSafe(document.referrer)) {
      window.history.back();
    } else {
      window.location.href = '../index.html';
    }
  };
});
