document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('phoneInput');
  const phoneError = document.getElementById('phoneError');
  const loginFields = document.getElementById('loginFields');
  const registerFields = document.getElementById('registerFields');
  const loginPassword = document.getElementById('loginPassword');
  const loginPasswordError = document.getElementById('loginPasswordError');
  const registerVerifyCode = document.getElementById('registerVerifyCode');
  const registerVerifyCodeError = document.getElementById('registerVerifyCodeError');
  const getVerifyCodeBtn = document.getElementById('getVerifyCodeBtn');
  const registerPassword = document.getElementById('registerPassword');
  const registerPasswordError = document.getElementById('registerPasswordError');
  const actionBtn = document.getElementById('actionBtn');

  const PHONE_REGEX = /^1[3-9]\d{9}$/;
  const VERIFY_CODE_DURATION = 60;
  let checkTimer = null;
  let verifyCodeTimer = null;
  let verifyCodeCountdown = 0;
  const state = {
    mode: null,
    isChecking: false,
    lastPhoneChecked: '',
    lastExistsResult: null
  };

  const urlParams = new URLSearchParams(window.location.search);
  const returnUrlParam = urlParams.get('return');

  phoneInput.addEventListener('input', () => {
    const sanitized = phoneInput.value.replace(/\D/g, '').slice(0, 11);
    if (phoneInput.value !== sanitized) {
      phoneInput.value = sanitized;
    }
    handlePhoneChange();
  });

  actionBtn.addEventListener('click', (event) => {
    event.preventDefault();
    submitAction();
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
    loginFields.classList.remove('hidden');
    registerFields.classList.add('hidden');
    loginPassword.value = '';
    loginPasswordError.textContent = '';
    setActionState(false, '立即登录');
  }

  function enterRegisterMode() {
    state.mode = 'register';
    registerFields.classList.remove('hidden');
    loginFields.classList.add('hidden');
    resetVerifyCodeState();
    registerVerifyCode.value = '';
    registerPassword.value = '';
    registerVerifyCodeError.textContent = '';
    registerPasswordError.textContent = '';
    setActionState(false, '立即注册');
  }

  function resetDynamicFields(clearMode = true) {
    if (clearMode) {
      state.mode = null;
      state.lastPhoneChecked = '';
      state.lastExistsResult = null;
    }
    loginFields.classList.add('hidden');
    registerFields.classList.add('hidden');
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
    actionBtn.disabled = disabled;
    if (text) {
      actionBtn.textContent = text;
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
    const phone = phoneInput.value;
    
    if (!PHONE_REGEX.test(phone)) {
      registerVerifyCodeError.textContent = '请先输入有效的手机号';
      return;
    }

    if (verifyCodeTimer) {
      clearInterval(verifyCodeTimer);
    }

    verifyCodeCountdown = VERIFY_CODE_DURATION;
    getVerifyCodeBtn.disabled = true;
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

    // 这里后续可以调用实际的发送验证码 API
    // 例如: await sendVerifyCode(phone);
    registerVerifyCodeError.textContent = 123456
  }

  async function submitAction() {
    const phone = phoneInput.value;
    if (!PHONE_REGEX.test(phone) || !state.mode || state.isChecking) {
      return;
    }

    if (state.mode === 'login') {
      await handleLogin(phone);
    } else {
      await handleRegister(phone);
    }
  }

  async function handleLogin(phone) {
    const password = loginPassword.value.trim();
    loginPasswordError.textContent = '';

    if (!password) {
      loginPasswordError.textContent = '请输入密码';
      return;
    }

    setActionState(true, '登录中...');
    const result = await userLoginPassword(phone, password);
    setActionState(false, '立即登录');

    if (result.code === 0) {
      redirectAfterAuth();
    } else {
      loginPasswordError.textContent = result.message || '登录失败，请重试';
    }
  }

  async function handleRegister(phone) {
    let valid = true;
    const verifyCode = registerVerifyCode.value.trim();
    const password = registerPassword.value.trim();

    registerVerifyCodeError.textContent = '';
    registerPasswordError.textContent = '';

    if (!verifyCode) {
      registerVerifyCodeError.textContent = '请输入验证码';
      valid = false;
    }

    if (!password || password.length < 8) {
      registerPasswordError.textContent = '密码至少8位';
      valid = false;
    }

    if (!valid) {
      return;
    }

    setActionState(true, '注册中...');
    const result = await userRegister(verifyCode, password, phone);
    setActionState(false, '立即注册');

    if (result.code === 0) {
      showToast('注册成功，已自动登录');
      redirectAfterAuth();
    } else {
      registerPasswordError.textContent = result.message || '注册失败，请重试';
    }
  }

  function redirectAfterAuth() {
    const targetUrl = returnUrlParam
      ? decodeURIComponent(returnUrlParam)
      : (document.referrer && !document.referrer.includes('login.html'))
        ? document.referrer
        : '../index.html';

    setTimeout(() => {
      window.location.replace(targetUrl);
    }, 600);
  }

  window.goBack = function goBack() {
    if (document.referrer) {
      window.history.back();
    } else {
      window.location.href = '../index.html';
    }
  };
});
