let selectedDateTime = '';
let presetCategories = {};
let currentCategory = null;
let timePicker = null;

// 页面初始化
function setupPage() {
  try {
    initElements();
    loadPresets().catch(err => {});
    initSmsForm();
  } catch (err) {
  }
}

// 初始化表单
function initSmsForm() {
  const form = document.getElementById('smsForm');
  const charCountEl = document.getElementById('charCount');
  const messageEl = document.getElementById('message');
  
  if (!form) return;
  
  // 实时显示字数
  if (messageEl) {
    messageEl.addEventListener('input', () => {
      if (charCountEl) {
        charCountEl.textContent = messageEl.value.length;
      }
    });
  }
  
  // 表单提交
  form.addEventListener('submit', handleSmsSubmit);
}

// 处理表单提交
async function handleSmsSubmit(e) {
  e.preventDefault();
  showToast('功能开发中，敬请期待');
  return;
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
  
  // 内容输入字数统计和价格计算
  if (contentInput && charCount) {
    contentInput.addEventListener('input', function() {
      const length = this.value.length;
      charCount.textContent = `${length}/500`;
      
      // 按37字一条计算价格
      const smsCount = Math.ceil(length / 37) || 0;
      const price = (smsCount * 1.99).toFixed(2);
      if (priceInfo) {
        priceInfo.textContent = `按照37个字一条计算，共￥${price}元`;
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
  
  // 提交订单
  if (submitBtn) {
    submitBtn.addEventListener('click', submitOrder);
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
  
  const phones = phone.split('\n').filter(p => p.trim());
  for (let p of phones) {
    if (!/^1[3-9]\d{9}$/.test(p.trim())) {
      phoneError.textContent = '手机号格式不正确';
      return false;
    }
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
    const data = await getPresets();
    presetCategories = data || {};
    
    const categories = Object.keys(presetCategories);
    if (categories.length > 0) {
      currentCategory = categories[0];
    }
  } catch (err) {
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
        document.getElementById('charCount').textContent = `${text.length}/999`;
        modal.style.display = 'none';
      };
      listContainer.appendChild(card);
    });
  }
  
  modal.style.display = 'flex';
  
  // 关闭按钮
  document.getElementById('closePreset').onclick = function() {
    modal.style.display = 'none';
  };
  
  // 点击遮罩关闭
  modal.onclick = function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// 提交订单
async function submitOrder() {
  if (!checkPhone()) {
    return;
  }
  
  const phone = document.getElementById('phone').value.trim();
  const content = document.getElementById('content').value.trim();
  
  if (!content) {
    showToast('请输入短信内容');
    return;
  }
  
  showLoading('处理中...');
  
  try {
    let userId = storage.get('user_id');
    if (!userId) {
      userId = await userLogin('wechat_sms_' + Date.now(), '用户', '');
      storage.set('user_id', userId);
    }
    
    const orderContent = `收信人: ${phone}\n发送时间: ${selectedDateTime || '立即发送'}\n短信内容: ${content}`;
    
    await createOrder(userId, 'sms', 'sms_relay', orderContent, 1.99);
    
    hideLoading();
    showToast('订单创建成功');
    
    setTimeout(() => {
      window.history.back();
    }, 1500);
  } catch (err) {
    hideLoading();
    showToast(err.message || '创建订单失败');
  }
}

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
  
  // 关闭按钮事件
  const closeBtn = document.getElementById('closeSmsPreview');
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }
  
  // 点击背景关闭
  const overlay = modal.querySelector('.sms-preview-overlay');
  if (overlay) {
    overlay.onclick = () => {
      modal.style.display = 'none';
    };
  }
}

