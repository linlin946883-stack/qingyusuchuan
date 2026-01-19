let selectedDateTime = '';
let presetCategories = {};
let currentCategory = null;
let timePicker = null;
let isLoggedInSms = false;
let currentPrices = { sms: 2.99, call: 19.00, human: 29.00 }; // 默认价格
let isAgreed = false; // 用户协议同意状态
let isSubmitting = false; // 防止重复提交标记
let currentSubmitToken = null; // 当前页面的一次性提交Token
let lastSubmitTime = 0; // 最后提交时间戳（防止快速点击）

// 页面初始化
function setupPage() {
  try {
    checkLoginStatusSms();
    initElements();
    loadPrices(); // 加载价格配置
    loadPresets().catch(err => {
      console.error('加载预设文案失败:', err);
    });
    showWarningModal(); // 显示温馨提示
    loadAgreementContent(); // 加载协议内容
    
    // 延迟获取Token，避免阻塞页面初始化
    // 使用setTimeout让其他初始化先完成
    setTimeout(() => {
      requestPageSubmitToken();
    }, 500);
  } catch (err) {
    console.error('页面初始化失败:', err);
  }
}

// 请求页面的提交Token
async function requestPageSubmitToken() {
  // 只在已登录时请求
  if (!isLoggedInSms) {
    return; // 静默返回，不输出日志
  }
  
  try {
    currentSubmitToken = await requestSubmitToken('sms');
  } catch (error) {
    // 静默失败，不影响用户体验
    currentSubmitToken = null;
  }
}

// 加载用户协议内容
async function loadAgreementContent() {
  try {
    const response = await fetch('../agreement.html');
    const content = await response.text();
    const agreementContent = document.getElementById('agreementContent');
    if (agreementContent) {
      // 创建一个临时 div 来解析 HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      // 提取 body 中的 container 内容
      const container = tempDiv.querySelector('.container');
      if (container) {
        agreementContent.innerHTML = container.innerHTML;
      } else {
        agreementContent.innerHTML = content;
      }
    }
  } catch (err) {
    console.error('加载协议内容失败:', err);
  }
}

// 显示温馨提示弹窗
function showWarningModal() {
  const modal = document.getElementById('warningModal');
  if (modal) {
    modal.style.display = 'flex';
    disableBodyScroll();
  }
}

// 关闭温馨提示弹窗
function closeWarningModal() {
  const modal = document.getElementById('warningModal');
  if (modal) {
    modal.style.display = 'none';
    enableBodyScroll();
  }
}

// 显示用户协议弹窗
function showAgreementModal() {
  const modal = document.getElementById('agreementModal');
  if (modal) {
    modal.style.display = 'flex';
    disableBodyScroll();
  }
}

// 关闭用户协议弹窗
function closeAgreementModal() {
  const modal = document.getElementById('agreementModal');
  if (modal) {
    modal.style.display = 'none';
    enableBodyScroll();
  }
}

// 加载价格配置
async function loadPrices() {
  try {
    currentPrices = await getPrices();
    // console.log('价格配置已加载:', currentPrices);
  } catch (err) {
    console.error('加载价格配置失败:', err);
  }
}

// 检查登录状态 - SMS页面
function checkLoginStatusSms() {
  // 只检查token是否存在，不需要同时检查userInfo
  isLoggedInSms = hasToken();
  updateSubmitButtonSms();
}

// 更新提交按钮状态 - SMS页面
function updateSubmitButtonSms() {
  const submitBtn = document.getElementById('submitBtn');
  if (!submitBtn) return;
  
  if (isLoggedInSms) {
    // 已登录 - 根据协议同意状态显示
    if (isAgreed) {
      submitBtn.innerHTML = '<span class="btn-icon">📨</span><span class="btn-text">立即发送短信</span>';
      submitBtn.onclick = submitOrder;
      submitBtn.classList.remove('disabled');
    } else {
      submitBtn.innerHTML = '<span class="btn-icon">⚠️</span><span class="btn-text">请勾选用户协议</span>';
      submitBtn.onclick = () => showToast('请先勾选用户协议');
      submitBtn.classList.add('disabled');
    }
  } else {
    // 未登录 - 显示登录按钮
    submitBtn.innerHTML = '<span class="btn-icon">🔑</span><span class="btn-text">登 录</span>';
    submitBtn.onclick = goToLoginSms;
    submitBtn.classList.remove('disabled');
  }
}

// 显示登录提示 - SMS
function goToLoginSms() {
  showToast('请在微信中使用此功能');
}

// 在适当的时机调用 setupPage
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupPage);
} else {
  setupPage();
}

// 初始化元素
function initElements() {
  
  const phoneInput = document.getElementById('phone');
  const contentInput = document.getElementById('content');
  const charCount = document.getElementById('charCount');
  const priceInfo = document.getElementById('priceInfo');
  const timeSelector = document.getElementById('timeSelector');
  const resetTime = document.getElementById('resetTime');
  const openPreset = document.getElementById('openPreset');
  const submitBtn = document.getElementById('submitBtn');
  const previewTag = document.getElementById('previewTag');
  
  if (!phoneInput) {
    return;
  }
  
  // 手机号输入验证
  phoneInput.addEventListener('blur', checkPhone);
  
  // 手机号输入过滤 - 阻止输入分隔符
  phoneInput.addEventListener('input', function(e) {
    // 移除所有非数字字符（包括逗号、空格、换行等分隔符）
    let value = this.value.replace(/[^\d]/g, '');
    // 限制最多11位
    if (value.length > 11) {
      value = value.substring(0, 11);
    }
    this.value = value;
  });
  
  // 阻止粘贴包含分隔符的内容
  phoneInput.addEventListener('paste', function(e) {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    // 只保留数字
    const cleanText = pastedText.replace(/[^\d]/g, '').substring(0, 11);
    this.value = cleanText;
    // 触发input事件以更新状态
    this.dispatchEvent(new Event('input', { bubbles: true }));
  });
  
  // 阻止键盘输入非数字字符
  phoneInput.addEventListener('keypress', function(e) {
    // 只允许数字键
    if (e.key && !/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  });
  
  // 内容输入字数统计和价格计算
  if (contentInput && charCount) {
    contentInput.addEventListener('input', function() {
      const length = this.value.length;
      charCount.textContent = `${length}/500`;
      
      // 计算并显示价格预估
      if (priceInfo) {
        if (length === 0) {
          priceInfo.textContent = '按照37个字一条计算，共￥0.00元';
        } else {
          // 按照37个字一条短信计算
          const smsCount = Math.ceil(length / 37);
          const totalPrice = (smsCount * currentPrices.sms).toFixed(2);
          priceInfo.textContent = `按照37个字一条计算，共${smsCount}条，￥${totalPrice}元`;
        }
      }
    });
  }
  
  // 时间选择
  if (timeSelector) {
    timeSelector.addEventListener('click', () => {
      if (!timePicker) {
        timePicker = new TimePicker({
          sheetId: 'pickerSheet',
          onConfirm: (dateTime) => {
            selectedDateTime = dateTime;
            if (dateTime) {
              document.getElementById('timeDisplay').textContent = dateTime;
              document.getElementById('timeDisplay').classList.remove('placeholder');
              document.getElementById('resetTime').style.display = 'block';
            } else {
              document.getElementById('timeDisplay').textContent = '立即发送（或选择指定时间）';
              document.getElementById('timeDisplay').classList.add('placeholder');
              document.getElementById('resetTime').style.display = 'none';
            }
          }
        });
      }
      timePicker.open();
    });
  }
  
  if (resetTime) {
    resetTime.addEventListener('click', function(e) {
      e.stopPropagation();
      resetDateTime();
    });
  }
  
  // 打开文案
  if (openPreset) {
    openPreset.addEventListener('click', showPresetModal);
  }
  
  // 预览短信
  if (previewTag) {
    previewTag.addEventListener('click', function(e) {
      e.stopPropagation();
      showSmsPreview();
    });
  }
  
  // 温馨提示关闭按钮
  const closeWarningBtn = document.getElementById('closeWarning');
  if (closeWarningBtn) {
    closeWarningBtn.addEventListener('click', closeWarningModal);
  }
  
  // 用户协议勾选框
  const agreeCheckbox = document.getElementById('agreeCheckbox');
  if (agreeCheckbox) {
    agreeCheckbox.addEventListener('change', function() {
      isAgreed = this.checked;
      updateSubmitButtonSms();
    });
  }
  
  // 打开用户协议
  const openAgreement = document.getElementById('openAgreement');
  if (openAgreement) {
    openAgreement.addEventListener('click', function(e) {
      e.preventDefault();
      showAgreementModal();
    });
  }
  
  // 关闭用户协议
  const closeAgreement = document.getElementById('closeAgreement');
  if (closeAgreement) {
    closeAgreement.addEventListener('click', closeAgreementModal);
  }
  
  // 同意用户协议按钮
  const agreeAgreement = document.getElementById('agreeAgreement');
  if (agreeAgreement) {
    agreeAgreement.addEventListener('click', function() {
      const checkbox = document.getElementById('agreeCheckbox');
      if (checkbox) {
        checkbox.checked = true;
        isAgreed = true;
        updateSubmitButtonSms();
      }
      closeAgreementModal();
    });
  }
  
  // 提交订单 - 先调用 updateSubmitButtonSms 确保按钮状态正确
  if (submitBtn) {
    updateSubmitButtonSms();
  }
}

// 验证手机号
function checkPhone() {
  const phoneInput = document.getElementById('phone');
  const phoneError = document.getElementById('phoneError');
  const phone = phoneInput.value.trim();
  
  if (!phone) {
    phoneError.textContent = '请输入手机号';
    return false;
  }
  
  // 短信服务仅支持单个手机号
  if (phone.includes(',') || phone.includes('\n') || phone.includes(' ')) {
    phoneError.textContent = '短信服务仅支持单个手机号，不能包含多个号码';
    return false;
  }
  
  // 验证手机号格式（11位，1开头，第二位3-9）
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    phoneError.textContent = '手机号格式不正确，请输入11位有效手机号';
    return false;
  }
  
  phoneError.textContent = '';
  return true;
}

// 重置时间
function resetDateTime() {
  selectedDateTime = '';
  document.getElementById('timeDisplay').textContent = '立即发送（或选择指定时间）';
  document.getElementById('timeDisplay').classList.add('placeholder');
  document.getElementById('resetTime').style.display = 'none';
}

// 加载预设文案
async function loadPresets() {
  try {
    const data = await getPresets('sms');
    const categoryOrder = ['复合', '告别', '表白', '祝福'];
    const ordered = {};

    categoryOrder.forEach(cat => {
      if (data && data[cat]) {
        ordered[cat] = data[cat];
      }
    });

    if (data) {
      Object.keys(data).forEach(cat => {
        if (!ordered[cat]) {
          ordered[cat] = data[cat];
        }
      });
    }

    presetCategories = ordered;
    
    const categories = Object.keys(presetCategories);
    if (categories.length > 0) {
      currentCategory = categories[0];
    }
  } catch (err) {
    console.error('加载预设文案失败:', err);
    presetCategories = {};
  }
}

// 显示文案选择弹窗
function showPresetModal() {
  const modal = document.getElementById('presetModal');
  const tabsContainer = document.getElementById('presetTabs');
  const listContainer = document.getElementById('presetList');
  
  // 渲染分类标签
  tabsContainer.innerHTML = '';
  Object.keys(presetCategories).forEach(category => {
    const tab = document.createElement('span');
    tab.className = 'preset-tab';
    if (category === currentCategory) {
      tab.classList.add('active');
    }
    tab.textContent = category;
    tab.onclick = function() {
      currentCategory = category;
      showPresetModal();
    };
    tabsContainer.appendChild(tab);
  });
  
  // 渲染文案列表
  listContainer.innerHTML = '';
  if (currentCategory && presetCategories[currentCategory]) {
    presetCategories[currentCategory].forEach(text => {
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.textContent = text;
      card.onclick = function() {
        document.getElementById('content').value = text;
        document.getElementById('charCount').textContent = `${text.length}/500`;
        
        // 计算并显示价格预估
        const length = text.length;
        const priceInfo = document.getElementById('priceInfo');
        if (priceInfo) {
          if (length === 0) {
            priceInfo.textContent = '按照37个字一条计算，共￥0.00元';
          } else {
            // 按照37个字一条短信计算
            const smsCount = Math.ceil(length / 37);
            const totalPrice = (smsCount * currentPrices.sms).toFixed(2);
            priceInfo.textContent = `按照37个字一条计算，共${smsCount}条，￥${totalPrice}元`;
          }
        }
        
        modal.style.display = 'none';
        enableBodyScroll();
      };
      listContainer.appendChild(card);
    });
  }
  
  modal.style.display = 'flex';
  disableBodyScroll();
  
  // 关闭按钮
  document.getElementById('closePreset').onclick = function() {
    modal.style.display = 'none';
    enableBodyScroll();
  };
  
  // 点击遮罩关闭
  modal.onclick = function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
      enableBodyScroll();
    }
  };
}

// 提交订单
async function submitOrder() {
  // 防止快速重复点击（至少间隔1秒）
  const now = Date.now();
  if (now - lastSubmitTime < 1000) {
    showToast('请勿频繁点击');
    return;
  }
  lastSubmitTime = now;
  
  // 防止重复提交
  if (isSubmitting) {
    showToast('正在处理中，请稍候...');
    return;
  }
  
  if (!checkPhone()) {
    return;
  }
  
  const phone = document.getElementById('phone').value.trim();
  const content = document.getElementById('content').value.trim();
  
  // 验证内容
  if (!content) {
    showToast('请输入短信内容');
    return;
  }
  
  // 验证内容长度
  if (content.length > 500) {
    showToast('短信内容不能超过500个字符');
    return;
  }
  
  // 设置提交状态
  isSubmitting = true;
  const submitBtn = document.getElementById('submitBtn');
  const originalBtnContent = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.6';
  submitBtn.style.cursor = 'not-allowed';
  
  showLoading('处理中...');
  
  try {
    let userInfo = getUserInfo();
    if (!userInfo) {
      hideLoading();
      // 恢复按钮状态
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      showToast('请先登录');
      return;
    }
    
    // 短信服务只支持单个手机号
    // 进行二次验证，确保没有多个手机号
    if (phone.includes(',') || phone.includes('\n') || phone.includes(' ')) {
      hideLoading();
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      showToast('短信服务仅支持单个手机号');
      return;
    }
    
    // 如果没有提交Token，尝试获取
    if (!currentSubmitToken) {
      try {
        currentSubmitToken = await requestSubmitToken('sms');
      } catch (error) {
        // 即使获取失败，也继续尝试提交（后端会处理）
      }
    }
    
    // 【安全】不再前端计算价格，由后端计算和验证
    // 如果用户没有选择时间，使用当前时间（确保格式一致）
    let scheduledTime = selectedDateTime;
    if (!scheduledTime) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      scheduledTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    const result = await createOrder(
      'sms',
      phone, // 直接传递单个手机号
      '手机短信',
      content,
      scheduledTime,
      0, // 价格由后端计算，这里传 0 或不传
      '',
      currentSubmitToken // 使用一次性Token
    );
    
    hideLoading();
    
    if (result.code === 0) {
      const orderId = result.data.order_id;
      const orderPrice = result.data.price;
      
      // 调起微信支付
      try {
        showLoading('正在调起支付...');
        
        // 使用微信支付工具类
        const payResult = await window.wechatPay.executePay(
          orderId,
          orderPrice,
          '轻羽速传-短信服务'
        );
        
        hideLoading();
        
        if (payResult.success) {
          showToast('支付成功');
          // Token已被使用，清空
          currentSubmitToken = null;
          setTimeout(() => {
            window.location.href = '../index.html';
          }, 800);
        }
      } catch (payError) {
        hideLoading();
        
        // 判断是否用户取消支付
        if (payError.cancelled) {
          showToast('支付已取消');
        } else {
          showToast(payError.message || '支付失败');
        }
        
        // 支付失败后重新请求Token
        currentSubmitToken = null;
        requestPageSubmitToken();
        
        // 恢复按钮状态
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    } else {
      // 订单创建失败
      currentSubmitToken = null;
      requestPageSubmitToken();
      
      // 恢复按钮状态
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      showToast(result.message || '创建订单失败');
    }
  } catch (err) {
    hideLoading();
    // 失败后重新请求Token
    currentSubmitToken = null;
    requestPageSubmitToken();
    // 恢复按钮状态
    isSubmitting = false;
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
    showToast(err.message || '创建订单失败');
  }
}

// 页面获得焦点时刷新登录状态和Token
window.addEventListener('focus', () => {
  checkLoginStatusSms();
  // 如果当前没有Token，重新请求
  if (isLoggedInSms && !currentSubmitToken) {
    requestPageSubmitToken();
  }
});

// 预览短信内容
function showSmsPreview() {
  const contentInput = document.getElementById('content');
  const content = contentInput ? contentInput.value.trim() : '';
  
  if (!content) {
    showToast('请输入短信内容');
    return;
  }
  
  const modal = document.getElementById('smsPreviewModal');
  const contentContainer = document.getElementById('smsPreviewContent');
  
  // 生成预览内容 - 显示完整内容
  const html = `
    <div class="sms-preview-full">
      <div class="sms-preview-text-full">${content}</div>
    </div>
  `;
  
  contentContainer.innerHTML = html;
  modal.style.display = 'flex';
  disableBodyScroll();
  
  // 关闭按钮事件
  const closeBtn = document.getElementById('closeSmsPreview');
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = 'none';
      enableBodyScroll();
    };
  }
  
  // 点击背景关闭
  const overlay = modal.querySelector('.sms-preview-overlay');
  if (overlay) {
    overlay.onclick = () => {
      modal.style.display = 'none';
      enableBodyScroll();
    };
  }
}

