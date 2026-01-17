
// 状态管理
let isLoggedInMy = false;
let userNameMy = '';
let userPhoneMy = '';
let userIdMy = null;
let ordersMy = [];
let ordersLoadingMy = false;
let showOrdersMy = false;
let currentTabMy = 'all';

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatusMy();
});

// 检查登录状态
function checkLoginStatusMy() {
    const userId = localStorage.getItem('user_id');
    const accountNameEl = document.getElementById('accountName');
    const accountPhoneEl = document.getElementById('accountPhone');
    const logoutBtnEl = document.getElementById('logoutBtn');
    const ordersSectionEl = document.getElementById('ordersSection');
    
    if (userId) {
        userIdMy = userId;
        isLoggedInMy = true;
        userNameMy = '用户';
        
        // 更新UI
        if (accountNameEl) accountNameEl.textContent = userNameMy;
        if (accountPhoneEl) accountPhoneEl.textContent = '点击查看详情';
        if (logoutBtnEl) logoutBtnEl.style.display = 'block';
        if (ordersSectionEl) ordersSectionEl.style.display = 'block';
        
        loadOrdersMy();
    } else {
        // 未登录状态
        if (accountNameEl) accountNameEl.textContent = '未登录';
        if (accountPhoneEl) accountPhoneEl.textContent = '点击登入账号';
        if (logoutBtnEl) logoutBtnEl.style.display = 'none';
    }
}

// 加载用户订单列表
async function loadOrdersMy() {
    if (!userIdMy) return;
    
    ordersLoadingMy = true;
    try {
        const response = await apiRequest(`/order/list?user_id=${userIdMy}`, { method: 'GET' });
        ordersMy = Array.isArray(response) ? response : [];
        
        // 如果订单列表已展开，刷新显示
        if (showOrdersMy) {
            displayFilteredOrdersMy();
        }
    } catch (err) {
        // 加载失败时无需提示
    } finally {
        ordersLoadingMy = false;
    }
}

// 获取筛选后的订单
function getFilteredOrdersMy() {
    if (currentTabMy === 'all') {
        return ordersMy;
    }
    return ordersMy.filter(order => order.status === currentTabMy);
}

// 显示筛选后的订单
function displayFilteredOrdersMy() {
    const filteredOrders = getFilteredOrdersMy();
    const ordersList = document.getElementById('ordersListMy');
    const emptyState = document.getElementById('emptyStateMy');
    
    if (filteredOrders.length === 0) {
        ordersList.style.display = 'none';
        emptyState.style.display = 'block';
        document.getElementById('emptyHintMy').textContent = getEmptyHintMy();
    } else {
        ordersList.style.display = 'flex';
        emptyState.style.display = 'none';
        
        ordersList.innerHTML = filteredOrders.map(order => `
            <div class="order-card-my order-${order.type}">
                <div class="order-header-my">
                    <div class="order-type-badge-my">${getOrderIconMy(order.type)}</div>
                    <div class="order-meta-my">
                        <div class="order-title-my">${typeLabelMy(order.type)}</div>
                        <div class="order-time-my">${formatDateMy(order.created_at)}</div>
                    </div>
                    <div class="order-status-badge-my status-${order.status}">
                        ${statusLabelMy(order.status)}
                    </div>
                </div>
                <div class="order-summary-my">
                    <span class="summary-label-my">服务内容：</span>
                    <span class="summary-text-my">${truncateContentMy(order.content, 80)}</span>
                </div>
                <div class="order-footer-my">
                    <div class="order-price-my">¥${order.price}</div>
                    <div class="order-actions-my">
                        <span class="action-btn-my">查看详情</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// 类型标签
function typeLabelMy(type) {
    const labels = {
        'sms': '传话短信',
        'call': '和解电话',
        'human': '人工传话'
    };
    return labels[type] || '订单';
}

// 获取订单图标
function getOrderIconMy(type) {
    const icons = {
        'sms': '📱',
        'call': '☎️',
        'human': '👤'
    };
    return icons[type] || '📋';
}

// 状态标签
function statusLabelMy(status) {
    const labels = {
        'pending': '待处理',
        'processing': '处理中',
        'completed': '已完成',
        'failed': '已失败'
    };
    return labels[status] || '未知';
}

// 截断内容显示
function truncateContentMy(content, length = 60) {
    if (!content) return '';
    return content.length > length ? content.substring(0, length) + '...' : content;
}

// 格式化日期
function formatDateMy(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
}

// 切换订单展示
function toggleOrdersMy() {
    showOrdersMy = !showOrdersMy;
    
    const orderTabs = document.getElementById('orderTabsMy');
    const ordersList = document.getElementById('ordersListMy');
    const emptyState = document.getElementById('emptyStateMy');
    const toggleIcon = document.getElementById('toggleIconMy');
    
    if (showOrdersMy) {
        orderTabs.style.display = 'flex';
        toggleIcon.textContent = '▼';
        
        if (ordersMy.length === 0 && !ordersLoadingMy) {
            loadOrdersMy();
        } else {
            displayFilteredOrdersMy();
        }
    } else {
        orderTabs.style.display = 'none';
        ordersList.style.display = 'none';
        emptyState.style.display = 'none';
        toggleIcon.textContent = '▶';
    }
}

// 切换标签
function switchTabMy(tab) {
    currentTabMy = tab;
    
    // 更新标签样式
    document.querySelectorAll('.tab-item-my').forEach(tabEl => {
        tabEl.classList.remove('active');
        if (tabEl.textContent === getTabTextMy(tab)) {
            tabEl.classList.add('active');
        }
    });
    
    displayFilteredOrdersMy();
}

// 获取标签文本
function getTabTextMy(tab) {
    const texts = {
        'all': '全部',
        'pending': '待处理',
        'completed': '已发送',
        'failed': '发送失败'
    };
    return texts[tab] || '全部';
}

// 获取空状态提示
function getEmptyHintMy() {
    const hints = {
        'all': '立即下单体验服务',
        'pending': '暂无待处理订单',
        'completed': '暂无已完成订单',
        'failed': '暂无失败订单'
    };
    return hints[currentTabMy] || '暂无订单';
}

// 处理登入点击
function handleLoginClick() {
    if (isLoggedInMy) {
        showToast('已登入账号');
        return;
    }
    
    // 使用 openid 自动登入
    performLoginMy('h5_user_' + Date.now());
}

// 执行登入
async function performLoginMy(openid) {
    try {
        const result = await userLogin(openid, '用户', '👤');
        
        const userData = result.data || result;
        userIdMy = userData.id || userData.user_id;
        isLoggedInMy = true;
        userNameMy = userData.nickname || '用户';
        
        // 保存到本地存储
        localStorage.setItem('user_id', userIdMy);
        
        hideLoading();
        
        // 更新UI
        checkLoginStatusMy();
        
        // 加载订单列表
        await loadOrdersMy();
    } catch (err) {
        hideLoading();
    }
}

// 处理登出
function handleLogoutMy() {
    isLoggedInMy = false;
    userNameMy = '';
    userPhoneMy = '';
    userIdMy = null;
    ordersMy = [];
    showOrdersMy = false;
    currentTabMy = 'all';
    
    localStorage.removeItem('user_id');
    
    // 重置UI
    checkLoginStatusMy();
    
    const ordersList = document.getElementById('ordersListMy');
    if (ordersList) {
        ordersList.innerHTML = '';
    }
    
    const orderTabs = document.getElementById('orderTabsMy');
    if (orderTabs) {
        orderTabs.style.display = 'none';
    }
}

// 联系客服
function contactServiceMy() {
    alert('联系客服\n\n客服微信：service_001\n客服电话：400-1234-567');
}

// 返回首页
function goHomeMy() {
    window.location.href = '../index.html';
}
