

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
    // 优先检查 Token
    if (hasToken()) {
        const userInfo = getUserInfo();
        if (userInfo) {
            userIdMy = userInfo.user_id;
            isLoggedInMy = true;
            userNameMy = userInfo.nickname || '用户';
            userPhoneMy = userInfo.phone || '';
            
            // 更新UI
            document.getElementById('accountName').textContent = userPhoneMy || '未登录';
            document.getElementById('accountPhone').style.display = 'none';
            document.getElementById('logoutBtn').style.display = 'block';
            document.getElementById('ordersSection').style.display = 'block';
            
            // 可选：验证 Token 是否仍然有效
            verifyTokenAndUpdateUI();
            
            loadOrdersMy();
            return;
        }
    }
    
    // 未登录状态 - 跳转到登录页面
    isLoggedInMy = false;
    window.location.href = 'login.html?return=' + encodeURIComponent(window.location.href);
}

/**
 * 验证 Token 并更新 UI
 */
async function verifyTokenAndUpdateUI() {
    try {
        const result = await verifyToken();
        if (result.code !== 0) {
            // Token 无效，自动登出
            handleLogoutMy();
        }
    } catch (err) {
        console.error('Token 验证出错:', err);
    }
}

// 加载用户订单列表
async function loadOrdersMy() {
    if (!userIdMy) return;
    
    ordersLoadingMy = true;
    try {
        const response = await getOrders(userIdMy);
        if (response.code === 0) {
            ordersMy = Array.isArray(response.data) ? response.data : [];
        } else {
            showToast(response.message || '加载订单失败');
        }
        
        // 如果订单列表已展开，刷新显示
        if (showOrdersMy) {
            displayFilteredOrdersMy();
        }
    } catch (err) {
        showToast('加载订单失败');
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
            <div class="order-card-my order-${order.type}" onclick="showOrderDetailMy(${order.id})" style="cursor: pointer;">
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
                        <span class="action-btn-my">查看详情 →</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        // 启动实时刷新轮询
        startOrderPolling();
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
        'sms': '<img src="../icon/duanxin.svg" alt="短信" style="width:20px;height:20px;vertical-align:top;">',
        'call': '<img src="../icon/dianhua.svg" alt="电话" style="width:20px;height:20px;vertical-align:top;">',
        'human': '<img src="../icon/weixin.svg" alt="人工" style="width:20px;height:20px;vertical-align:top;">'
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
    if (!isLoggedInMy) {
        showToast('请先登录');
        return;
    }
    
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
        return;
    }
    
    // 使用 openid 自动登入
    performLoginMy('h5_user_' + Date.now());
}

// 执行登入
async function performLoginMy(openid) {
    try {
        showLoading('登入中...');
        const result = await userLogin(openid, '用户', '👤');
        
        if (result.code === 0) {
            // 更新本地状态
            userIdMy = result.data.user.id;
            isLoggedInMy = true;
            userNameMy = result.data.user.nickname || '用户';
            userPhoneMy = result.data.user.phone || '';
            
            hideLoading();
            
            // 更新UI
            checkLoginStatusMy();
            
            // 加载订单列表
            await loadOrdersMy();
        } else {
            hideLoading();
        }
    } catch (err) {
        hideLoading();
    }
}

// 处理登出
function handleLogoutMy() {
    // 清除登录状态
    userLogout();
    
    // 停止轮询
    stopOrderPolling();
    
    // 重置状态
    isLoggedInMy = false;
    userNameMy = '';
    userPhoneMy = '';
    userIdMy = null;
    ordersMy = [];
    showOrdersMy = false;
    currentTabMy = 'all';
    
    // 更新UI
    document.getElementById('accountName').textContent = '未登录';
    document.getElementById('accountPhone').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('ordersSection').style.display = 'none';
    
    // 返回首页
    setTimeout(() => {
        window.location.href = '../index.html';
    }, 300);
}

// 联系客服
function contactServiceMy() {
    alert('联系客服\n\n客服微信：service_001\n客服电话：400-1234-567');
}

// 返回首页
function goHomeMy() {
    window.location.href = '../index.html';
}

// ==================== 订单详情和实时更新 ====================

let orderPollingInterval = null;

// 显示订单详情
async function showOrderDetailMy(orderId) {
    try {
        const result = await getOrderDetail(orderId);
        if (result.code === 0 && result.data) {
            const order = result.data;
            const modal = document.getElementById('orderDetailModal');
            const modalBody = document.getElementById('modalBody');
            
            // 获取订单图标和类型标签
            const typeIcon = getOrderIconMy(order.type);
            const typeLabel = typeLabelMy(order.type);
            const statusLabel = statusLabelMy(order.status);
            const fullDate = new Date(order.created_at).toLocaleString('zh-CN');
            const updateDate = new Date(order.updated_at).toLocaleString('zh-CN');
            
            // 构建详情内容
            modalBody.innerHTML = `
                <div class="detail-type-icon-my">${typeIcon}</div>
                <div class="detail-item-my">
                    <span class="detail-label-my">订单类型</span>
                    <span class="detail-value-my">${typeLabel}</span>
                </div>
                <div class="detail-item-my">
                    <span class="detail-label-my">订单状态</span>
                    <span class="detail-value-my">
                        <span class="detail-status-badge-my status-${order.status}">${statusLabel}</span>
                    </span>
                </div>
                <div class="detail-item-my">
                    <span class="detail-label-my">订单金额</span>
                    <span class="detail-value-my" style="color: #ef4444; font-weight: 600; font-size: 16px;">¥${order.price}</span>
                </div>
                <div class="detail-item-my">
                    <span class="detail-label-my">联系电话</span>
                    <span class="detail-value-my">${order.contact_phone || '未提供'}</span>
                </div>
                <div class="detail-item-my">
                    <span class="detail-label-my">联系方式</span>
                    <span class="detail-value-my">${order.contact_method || '未提供'}</span>
                </div>
                <div class="detail-item-my">
                    <span class="detail-label-my">服务内容</span>
                    <span class="detail-value-my">${order.content || '未提供'}</span>
                </div>
                ${order.scheduled_time ? `
                <div class="detail-item-my">
                    <span class="detail-label-my">计划时间</span>
                    <span class="detail-value-my">${new Date(order.scheduled_time).toLocaleString('zh-CN')}</span>
                </div>
                ` : ''}
                <div class="detail-item-my">
                    <span class="detail-label-my">创建时间</span>
                    <span class="detail-value-my">${fullDate}</span>
                </div>
                <div class="detail-item-my">
                    <span class="detail-label-my">更新时间</span>
                    <span class="detail-value-my">${updateDate}</span>
                </div>
            `;
            
            // 显示模态框
            modal.classList.add('show');
            
            // 禁用背景滚动
            document.body.style.overflow = 'hidden';
        } else {
            showToast('获取订单详情失败');
        }
    } catch (err) {
        console.error('获取订单详情出错:', err);
        showToast('获取订单详情出错');
    }
}

// 关闭订单详情模态框
function closeOrderDetailMy() {
    const modal = document.getElementById('orderDetailModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// 启动订单轮询刷新
function startOrderPolling() {
    // 清除旧的轮询
    if (orderPollingInterval) {
        clearInterval(orderPollingInterval);
    }
    
    // 每10秒刷新一次订单列表
    orderPollingInterval = setInterval(() => {
        if (showOrdersMy && userIdMy) {
            loadOrdersMy();
        }
    }, 10000);
}

// 停止订单轮询
function stopOrderPolling() {
    if (orderPollingInterval) {
        clearInterval(orderPollingInterval);
        orderPollingInterval = null;
    }
}

