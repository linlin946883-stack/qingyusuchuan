let contactMethods = ["手机短信", "微信", "QQ", "抖音", "快手", "小红书", "其他平台"];
let selectedContactMethod = '';
let selectedDateTime = '';
let presetCategories = {};
let currentCategory = null;
let timePickerHuman = null;
let isLoggedInHuman = false;
let currentPrices = { sms: 2.99, call: 19.00, human: 29.00 }; // 默认价格
let isSubmitting = false; // 防止重复提交标记
let currentSubmitToken = null; // 当前页面的一次性提交Token
let lastSubmitTime = 0; // 最后提交时间戳（防止快速点击）

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
  checkLoginStatusHuman();
  initHumanPage();
  loadPrices(); // 加载价格配置
  loadPresets();
  requestPageSubmitTokenHuman(); // 请求提交Token
});

// 请求页面的提交Token
async function requestPageSubmitTokenHuman() {
  if (isLoggedInHuman) {
    currentSubmitToken = await requestSubmitToken('human');
    if (!currentSubmitToken) {
      console.warn('获取提交Token失败，将在提交时重新获取');
    }
  }
}

// 加载价格配置
async function loadPrices() {
  try {
    currentPrices = await getPrices();
    // console.log('价格配置已加载:', currentPrices);
    updatePriceDisplay();
  } catch (err) {
    console.error('加载价格配置失败:', err);
  }
}

// 更新页面价格显示
function updatePriceDisplay() {
  const priceTag = document.getElementById('priceTagHuman');
  if (priceTag) {
    priceTag.textContent = `¥${currentPrices.human.toFixed(2)}`;
  }
}

// 检查登录状态 - Human页面
function checkLoginStatusHuman() {
  isLoggedInHuman = hasToken() && getUserInfo();
  updateSubmitButtonHuman();
}

// 更新提交按钮状态 - Human页面
function updateSubmitButtonHuman() {
  const submitBtnHuman = document.getElementById('submitBtnHuman');
  if (!submitBtnHuman) return;
  
  if (isLoggedInHuman) {
    // 已登录 - 显示原功能
    submitBtnHuman.innerHTML = '<span class="btn-icon-human">💬</span><span class="btn-text-human">立即提交传话</span>';
    submitBtnHuman.onclick = submitOrderHuman;
  } else {
    // 未登录 - 显示登录按钮
    submitBtnHuman.innerHTML = '<span class="btn-icon-human">🔑</span><span class="btn-text-human">登 录</span>';
    submitBtnHuman.onclick = goToLoginHuman;
  }
}

// 跳转到登录页面 - Human
function goToLoginHuman() {
  window.location.href = 'login.html?return=' + encodeURIComponent(window.location.href);
}

function initHumanPage() {
  // 元素绑定
  const contactSelector = document.getElementById('contactSelector');
  const timeSelectorHuman = document.getElementById('timeSelectorHuman');
  const resetTimeHuman = document.getElementById('resetTimeHuman');
  const openPresetHuman = document.getElementById('openPresetHuman');
  const submitBtnHuman = document.getElementById('submitBtnHuman');
  const openFaq = document.getElementById('openFaq');
  const messageHuman = document.getElementById('messageHuman');
  const charCountHuman = document.getElementById('charCountHuman');

  contactSelector && contactSelector.addEventListener('click', showContactModal);
  timeSelectorHuman && timeSelectorHuman.addEventListener('click', () => {
    if (!timePickerHuman) {
      timePickerHuman = new TimePicker({
        sheetId: 'pickerSheetHuman',
        onConfirm: (dateTime) => {
          selectedDateTime = dateTime;
          if (dateTime) {
            document.getElementById('timeDisplayHuman').textContent = dateTime;
            document.getElementById('timeDisplayHuman').classList.remove('placeholder');
            document.getElementById('resetTimeHuman').style.display = 'block';
          } else {
            document.getElementById('timeDisplayHuman').textContent = '立即传达（或选择指定时间）';
            document.getElementById('timeDisplayHuman').classList.add('placeholder');
            document.getElementById('resetTimeHuman').style.display = 'none';
          }
        }
      });
    }
    timePickerHuman.open();
  });
  resetTimeHuman && resetTimeHuman.addEventListener('click', (e) => {
    e.stopPropagation();
    resetDateTimeHuman();
  });
  openPresetHuman && openPresetHuman.addEventListener('click', showPresetModalHuman);
  submitBtnHuman && updateSubmitButtonHuman();
  openFaq && openFaq.addEventListener('click', showFaqModal);
  messageHuman && messageHuman.addEventListener('input', () => {
    charCountHuman.textContent = `${messageHuman.value.length}/999`;
  });
}

// 显示联系方式选择弹窗
function showContactModal() {
  const modal = document.getElementById('contactModal');
  const grid = document.getElementById('methodGrid');
  
  // 渲染网格
  grid.innerHTML = contactMethods.map((method, idx) => {
    const icon = getMethodIcon(method);
    const active = selectedContactMethod === method ? ' active' : '';
    const check = selectedContactMethod === method ? `<span class="check-icon-human">✓</span>` : '';
    return `
      <div class="method-card-human${active}" data-method="${method}">
        <span class="method-icon-human">${icon}</span>
        <span class="method-label-human">${method}</span>
        ${check}
      </div>
    `;
  }).join('');
  
  modal.style.display = 'flex';
  disableBodyScroll();
  
  // 绑定选择事件
  grid.querySelectorAll('.method-card-human').forEach(card => {
    card.onclick = () => {
      selectedContactMethod = card.dataset.method;
      document.getElementById('contactDisplay').textContent = selectedContactMethod;
      document.getElementById('contactDisplay').classList.remove('placeholder');
      // 选择后显示价格标签
      const priceTag = document.getElementById('priceTagHuman');
      if (priceTag) {
        priceTag.style.display = 'block';
      }
      modal.style.display = 'none';
      enableBodyScroll();
    };
  });
  
  document.getElementById('closeContact').onclick = () => { 
    modal.style.display = 'none';
    enableBodyScroll();
  };
  modal.onclick = (e) => { 
    if (e.target === modal) {
      modal.style.display = 'none';
      enableBodyScroll();
    }
  };
}

function getMethodIcon(method) {
  const icons = {
    '手机短信': '📱',
    '微信': '💬',
    'QQ': '🐧',
    '抖音': '🎵',
    '快手': '⚡',
    '小红书': '📕',
    '其他平台': '🌐'
  };
  return icons[method] || '📱';
}

// 重置时间
function resetDateTimeHuman() {
  selectedDateTime = '';
  document.getElementById('timeDisplayHuman').textContent = '立即传达（或选择指定时间）';
  document.getElementById('timeDisplayHuman').classList.add('placeholder');
  document.getElementById('resetTimeHuman').style.display = 'none';
}

// 文案预设
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
  }
}

function showPresetModalHuman() {
  const modal = document.getElementById('presetModalHuman');
  const tabsContainer = document.getElementById('presetTabsHuman');
  const listContainer = document.getElementById('presetListHuman');
  
  tabsContainer.innerHTML = '';
  Object.keys(presetCategories).forEach(category => {
    const tab = document.createElement('span');
    tab.className = 'preset-tab-human';
    if (category === currentCategory) {
      tab.classList.add('active');
    }
    tab.textContent = category;
    tab.onclick = function() {
      currentCategory = category;
      showPresetModalHuman();
    };
    tabsContainer.appendChild(tab);
  });
  
  listContainer.innerHTML = '';
  if (currentCategory && presetCategories[currentCategory]) {
    presetCategories[currentCategory].forEach(text => {
      const card = document.createElement('div');
      card.className = 'preset-card-human';
      card.textContent = text;
      card.onclick = function() {
        document.getElementById('messageHuman').value = text;
        document.getElementById('charCountHuman').textContent = `${text.length}/500`;
        modal.style.display = 'none';
        enableBodyScroll();
      };
      listContainer.appendChild(card);
    });
  }
  
  modal.style.display = 'flex';
  disableBodyScroll();
  document.getElementById('closePresetHuman').onclick = () => { 
    modal.style.display = 'none';
    enableBodyScroll();
  };
  modal.onclick = (e) => { 
    if (e.target === modal) {
      modal.style.display = 'none';
      enableBodyScroll();
    }
  };
}

// FAQ
function showFaqModal() {
  const modal = document.getElementById('faqModal');
  modal.style.display = 'flex';
  disableBodyScroll();
  document.getElementById('closeFaq').onclick = () => { 
    modal.style.display = 'none';
    enableBodyScroll();
  };
  modal.onclick = (e) => { 
    if (e.target === modal) {
      modal.style.display = 'none';
      enableBodyScroll();
    }
  };
}

// 提交订单
async function submitOrderHuman() {
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
  
  // 检查登录状态
  if (!isLoggedInHuman) {
    goToLoginHuman();
    return;
  }
  
  if (!selectedContactMethod) {
    showToast('请选择联系方式');
    return;
  }
  
  const targetAccount = document.getElementById('targetAccount').value.trim();
  if (!targetAccount) {
    showToast('请输入对方社交账号');
    return;
  }
  
  const message = document.getElementById('messageHuman').value.trim();
  if (!message) {
    showToast('请输入传话内容');
    return;
  }
  
  // 设置提交状态
  isSubmitting = true;
  const submitBtn = document.getElementById('submitBtnHuman');
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
    
    const remark = document.getElementById('remarkHuman').value.trim();
    
    // 【安全】价格由后端根据联系方式计算
    const result = await createOrder(
      'human',
      targetAccount,
      selectedContactMethod,
      message,
      selectedDateTime || null,
      0, // 价格由后端计算
      remark,
      currentSubmitToken // 使用一次性Token
    );
    
    hideLoading();
    
    if (result.code === 0) {
      const orderId = result.data.order_id;
      const orderPrice = result.data.price;
      
      // 如果价格为0（"其他平台"），直接成功
      if (orderPrice === 0) {
        showToast('订单已创建');
        currentSubmitToken = null;
        setTimeout(() => { window.location.href = '../index.html'; }, 1500);
      } else {
        // 需要支付
        try {
          const payResult = await window.wechatPay.executePay(
            orderId,
            orderPrice,
            '轻羽速传-人工服务'
          );
          
          if (payResult.success) {
            showToast('支付成功');
            currentSubmitToken = null;
            setTimeout(() => { window.location.href = '../index.html'; }, 800);
          }
        } catch (payError) {
          if (payError.cancelled) {
            showToast('支付已取消');
          } else {
            showToast(payError.message || '支付失败');
          }
          currentSubmitToken = null;
          requestPageSubmitTokenHuman();
          
          // 恢复按钮状态
          isSubmitting = false;
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
        }
      }
    } else {
      // 清空Token并重新请求
      currentSubmitToken = null;
      requestPageSubmitTokenHuman();
      // 恢复按钮状态
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      showToast(result.message || '提交失败');
    }
  } catch (err) {
    hideLoading();
    // 清空Token并重新请求
    currentSubmitToken = null;
    requestPageSubmitTokenHuman();
    // 恢复按钮状态
    isSubmitting = false;
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
    showToast(err.message || '提交失败');
  }
}




// 页面初始化完成
