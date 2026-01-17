/* 一比一还原自 call.vue 的核心交互 (原 uni.* 改为原生 DOM + fetch) */

document.addEventListener('DOMContentLoaded', () => {
    initRelayCallPage();
    initCallForm();
    initTemplateSelection();
});

function initCallForm() {
    const form = document.getElementById('callForm');
    const charCountEl = document.getElementById('callCharCount');
    const scriptEl = document.getElementById('callScript');
    const fileInput = document.getElementById('callAudio');
    const fileNameEl = document.getElementById('fileName');
    
    if (!form) return;
    
    // 实时显示字数
    if (scriptEl) {
        scriptEl.addEventListener('input', () => {
            if (charCountEl) {
                charCountEl.textContent = scriptEl.value.length;
            }
        });
    }
    
    // 文件选择变化
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (fileNameEl) {
                    fileNameEl.textContent = `✓ ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
                }
            } else {
                if (fileNameEl) {
                    fileNameEl.textContent = '未选择文件';
                }
            }
        });
    }
    
    // 表单提交
    form.addEventListener('submit', handleCallSubmit);
}

// 初始化贺卡模板选择
function initTemplateSelection() {
    const templateCards = document.querySelectorAll('.template-card');
    const selectedTemplateInput = document.getElementById('selectedTemplate');
    
    if (templateCards.length === 0) return;
    
    // 设置第一个模板为默认选中
    templateCards[0].classList.add('active');
    
    // 为每个模板卡片添加点击事件
    templateCards.forEach(card => {
        card.addEventListener('click', () => {
            // 移除所有卡片的 active 类
            templateCards.forEach(c => c.classList.remove('active'));
            
            // 给当前点击的卡片添加 active 类
            card.classList.add('active');
            
            // 更新隐藏输入框的值
            const templateType = card.getAttribute('data-template');
            selectedTemplateInput.value = templateType;
            
            showToast(`已选择 ${card.querySelector('.template-label').textContent}`);
        });
    });
}

// 处理表单提交
async function handleCallSubmit(e) {
    e.preventDefault();
    showToast('功能开发中，敬请期待');
    return;
}

function initRelayCallPage() {
    // 初始显示条款弹窗
    const overlay = document.getElementById('termsOverlay');
    if (overlay) overlay.style.display = 'flex';

    // 事件绑定
    const btnAgree = document.getElementById('btnAgree');
    const btnDisagree = document.getElementById('btnDisagree');
    const toggle = document.getElementById('detailToggle');
    const submitBtn = document.getElementById('submitBtn');
    const serviceBtn = document.getElementById('serviceBtn');
    const phoneInput = document.getElementById('phoneInput');

    btnAgree && btnAgree.addEventListener('click', () => {
        overlay.style.display = 'none';
        if (navigator.vibrate) navigator.vibrate(30);
    });

    btnDisagree && btnDisagree.addEventListener('click', () => {
        // 直接返回上一页或首页
        if (history.length > 1) {
            history.back();
        } else {
            window.location.href = 'index.html';
        }
    });

    toggle && toggle.addEventListener('click', () => {
        const content = document.getElementById('detailContent');
        const text = document.getElementById('toggleText');
        const icon = document.getElementById('toggleIcon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            text.textContent = '收起详情';
            icon.textContent = '▲';
        } else {
            content.style.display = 'none';
            text.textContent = '查看详细说明';
            icon.textContent = '▼';
        }
    });

    phoneInput && phoneInput.addEventListener('blur', validatePhone);
    submitBtn && submitBtn.addEventListener('click', handleSubmitOrder);
    serviceBtn && serviceBtn.addEventListener('click', showServiceContact);
}

function validatePhone() {
    const val = document.getElementById('phoneInput').value.trim();
    const errEl = document.getElementById('phoneError');
    if (!val) {
        showPhoneError('请输入手机号');
        return false;
    }
    if (!/^1[3-9]\d{9}$/.test(val)) {
        showPhoneError('请输入有效的手机号码');
        return false;
    }
    errEl.style.display = 'none';
    errEl.textContent = '';
    return true;
}

function showPhoneError(msg) {
    const errEl = document.getElementById('phoneError');
    errEl.textContent = msg;
    errEl.style.display = 'block';
}

async function handleSubmitOrder(e) {
    if (!validatePhone()) {
        showToast('请输入有效的手机号');
        return;
    }

    const phone = document.getElementById('phoneInput').value.trim();

    // 二次确认
    if (!confirm(`您确认要为 ${phone} 生成和解电话号码吗？请确保对方号码正确，虚拟商品不接受退款。`)) {
        return;
    }

    const btn = e.currentTarget;
    if (btn.dataset.loading === '1') return;
    btn.dataset.loading = '1';
    btn.textContent = '处理中...';

    try {
        // 获取或创建用户
        let userInfo = storage.get('userInfo') || {};
        let userId = userInfo.user_id;
        if (!userId) {
            const user = await userLogin('h5_call_' + Date.now(), 'H5用户', '');
            userId = user.user_id;
            userInfo.user_id = userId;
            storage.set('userInfo', userInfo);
        }

        // 创建订单 (价格 19.00 与原 vue 逻辑保持一致)
        await createOrder(
            userId,
            'call',
            'voice_relay',
            `对方手机号: ${phone}`,
            19.00
        );

        showToast('订单已创建，请等待号码生成');
        alert('订单已成功创建！\n\n预计 5-10 分钟生成专属号码，届时将以短信形式通知您。请保持手机畅通，感谢您的耐心等待。');
        setTimeout(() => { window.location.href = '../index.html'; }, 1200);
    } catch (err) {
        showToast(err.message || '提交失败');
    } finally {
        btn.dataset.loading = '0';
        btn.textContent = '📞 提交拨打';
    }
}

function showServiceContact() {
    alert('客服微信：123456789');
}
