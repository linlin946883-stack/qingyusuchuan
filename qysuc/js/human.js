
let contactMethods = ["手机短信", "微信", "QQ", "抖音", "快手", "小红书", "其他平台"];
let selectedContactMethod = '';
let selectedDateTime = '';
let presetCategories = {};
let currentCategory = null;
let timePickerHuman = null;

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
  initHumanPage();
  loadPresets();
  initHumanForm();
});

function initHumanForm() {
    const form = document.getElementById('humanForm');
    const charCountEl = document.getElementById('humanCharCount');
    const contentEl = document.getElementById('humanContent');
    
    if (!form) return;
    
    // 实时显示字数
    if (contentEl) {
        contentEl.addEventListener('input', () => {
            if (charCountEl) {
                charCountEl.textContent = contentEl.value.length;
            }
        });
    }
    
    // 表单提交
    form.addEventListener('submit', handleHumanSubmit);
}

// 处理表单提交
async function handleHumanSubmit(e) {
    e.preventDefault();
    showToast('功能开发中，敬请期待');
    return;
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
  submitBtnHuman && submitBtnHuman.addEventListener('click', submitOrderHuman);
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
    };
  });
  
  document.getElementById('closeContact').onclick = () => { modal.style.display = 'none'; };
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
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
    const data = await getPresets();
    presetCategories = data || {};
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
        document.getElementById('charCountHuman').textContent = `${text.length}/999`;
        modal.style.display = 'none';
      };
      listContainer.appendChild(card);
    });
  }
  
  modal.style.display = 'flex';
  document.getElementById('closePresetHuman').onclick = () => { modal.style.display = 'none'; };
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

// FAQ
function showFaqModal() {
  const modal = document.getElementById('faqModal');
  modal.style.display = 'flex';
  document.getElementById('closeFaq').onclick = () => { modal.style.display = 'none'; };
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

// 提交订单
async function submitOrderHuman() {
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
  
  showLoading('处理中...');
  
  try {
    let userId = storage.get('user_id');
    if (!userId) {
      userId = await userLogin('h5_human_' + Date.now(), 'H5用户', '');
      storage.set('user_id', userId);
    }
    
    const remark = document.getElementById('remarkHuman').value.trim();
    const content = `联系方式: ${selectedContactMethod}\n对方账号: ${targetAccount}\n传话时间: ${selectedDateTime || '立即发送'}\n传话内容: ${message}${remark ? '\n备注: ' + remark : ''}`;
    
    await createOrder(userId, 'human', 'personal_relay', content, selectedContactMethod === "其他平台" ? 0 : 25.00);
    
    hideLoading();
    showToast('订单已创建');
    setTimeout(() => { window.location.href = '../index.html'; }, 1500);
  } catch (err) {
    hideLoading();
    showToast(err.message || '提交失败');
  }
}


// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    loadPresets();
    initHumanPage();
});
