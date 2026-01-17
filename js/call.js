let isLoggedInCall = false;
let currentPrices = { sms: 2.99, call: 19.00, human: 25.00 }; // 默认价格
let isSubmitting = false; // 防止重复提交标记
let currentSubmitToken = null; // 当前页面的一次性提交Token
let lastSubmitTime = 0; // 最后提交时间戳（防止快速点击）

document.addEventListener('DOMContentLoaded', () => {
    initRelayCallPage();
});

function initRelayCallPage() {
    // 检查登录状态
    checkLoginStatusCall();
    
    // 加载价格配置
    loadPrices();
    
    // 请求提交Token
    requestPageSubmitTokenCall();
    
    // 初始显示条款弹窗
    const overlay = document.getElementById('termsOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        disableBodyScroll();
    }

    // 事件绑定
    const btnAgree = document.getElementById('btnAgree');
    const btnDisagree = document.getElementById('btnDisagree');
    const toggle = document.getElementById('detailToggle');
    const submitBtn = document.getElementById('submitBtn');
    const serviceBtn = document.getElementById('serviceBtn');
    const phoneInput = document.getElementById('phoneInput');

    btnAgree && btnAgree.addEventListener('click', () => {
        overlay.style.display = 'none';
        enableBodyScroll();
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
    phoneInput && phoneInput.addEventListener('input', (e) => {
        // 只允许输入数字
        e.target.value = e.target.value.replace(/\D/g, '');
        // 限制最多11位
        if (e.target.value.length > 11) {
            e.target.value = e.target.value.slice(0, 11);
        }
    });
    // submitBtn 的事件由 updateSubmitButtonCall() 统一管理，不在这里绑定
    serviceBtn && serviceBtn.addEventListener('click', showServiceContact);
    
    // 更新提交按钮状态（会根据登录状态设置正确的事件）
    updateSubmitButtonCall();
}

// 检查登录状态 - Call页面
function checkLoginStatusCall() {
    isLoggedInCall = hasToken() && getUserInfo();
}

// 请求页面的提交Token
async function requestPageSubmitTokenCall() {
    if (isLoggedInCall) {
        currentSubmitToken = await requestSubmitToken('call');
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
        // 更新页面显示的价格
        updatePriceDisplay();
    } catch (err) {
        console.error('加载价格配置失败:', err);
    }
}

// 更新页面价格显示
function updatePriceDisplay() {
    const priceElements = document.querySelectorAll('.price-tag, .price-amount');
    priceElements.forEach(el => {
        if (el.textContent.includes('19')) {
            el.textContent = el.textContent.replace('19', currentPrices.call.toFixed(2));
        }
    });
}

// 更新提交按钮状态 - Call页面
function updateSubmitButtonCall() {
    const submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) return;
    
    if (isLoggedInCall) {
        // 已登录 - 显示原功能
        submitBtn.textContent = '📞 提交拨打';
        submitBtn.onclick = handleSubmitOrder;
    } else {
        // 未登录 - 显示登录按钮
        submitBtn.textContent = '🔑 登 录';
        submitBtn.onclick = goToLoginCall;
    }
}

// 跳转到登录页面 - Call
function goToLoginCall() {
    window.location.href = 'login.html?return=' + encodeURIComponent(window.location.href);
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
    if (!isLoggedInCall) {
        goToLoginCall();
        return;
    }
    
    if (!validatePhone()) {
        showToast('请输入有效的手机号');
        return;
    }

    const phone = document.getElementById('phoneInput').value.trim();

    // 获取按钮元素（兼容 onclick 和 addEventListener）
    const btn = e?.currentTarget || e?.target || document.getElementById('submitBtn');
    if (!btn) return;
    
    // 双重检查防止重复提交
    if (btn.dataset.loading === '1' || isSubmitting) {
        showToast('正在处理中，请稍候...');
        return;
    }
    
    // 设置提交状态
    isSubmitting = true;
    btn.dataset.loading = '1';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
    const originalText = btn.textContent;
    btn.textContent = '处理中...';

    try {
        // 获取用户信息
        let userInfo = getUserInfo();
        if (!userInfo) {
            showToast('请先登录');
            // 恢复按钮状态
            isSubmitting = false;
            btn.dataset.loading = '0';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.textContent = originalText;
            return;
        }

        // 【安全】创建订单，价格由后端计算
        const scheduledTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const result = await createOrder(
            'call',
            phone,
            '电话',
            '',
            scheduledTime,
            0, // 价格由后端计算
            '',
            currentSubmitToken // 使用一次性Token
        );

        if (result.code === 0) {
            const orderId = result.data.order_id;
            const orderPrice = result.data.price;
            
            try {
                // 调起微信支付
                const payResult = await window.wechatPay.executePay(
                    orderId,
                    orderPrice,
                    '轻羽速传-电话服务'
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
                requestPageSubmitTokenCall();
            }
        } else {
            currentSubmitToken = null; // 清空Token
            requestPageSubmitTokenCall(); // 重新请求
            showToast(result.message || '提交失败');
        }
    } catch (err) {
        currentSubmitToken = null; // 清空Token
        requestPageSubmitTokenCall(); // 重新请求
        showToast(err.message || '提交失败');
    } finally {
        // 恢复按钮状态
        isSubmitting = false;
        btn.dataset.loading = '0';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.textContent = originalText;
    }
}

function showServiceContact() {
    alert('客服微信：123456789');
}

// 页面获得焦点时刷新登录状态和Token
window.addEventListener('focus', () => {
    checkLoginStatusCall();
    updateSubmitButtonCall();
    // 如果当前没有Token，重新请求
    if (isLoggedInCall && !currentSubmitToken) {
        requestPageSubmitTokenCall();
    }
});
