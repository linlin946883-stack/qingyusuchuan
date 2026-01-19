// 状态管理
let isLoggedInMy = false;
let userNameMy = '';
let userOpenidMy = '';
let userAvatarMy = '';
let userIdMy = null;
let ordersMy = [];
let ordersLoadingMy = false;
let showOrdersMy = false;
let currentTabMy = 'all';

// 解析 JWT Token
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('解析 JWT 失败:', e);
        return null;
    }
}

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatusMy();
    
    // 绑定所有事件监听器
    setupEventListeners();
});

// 设置所有事件监听器
function setupEventListeners() {
    // 订单展开/收起按钮
    const toggleBtn = document.getElementById('toggleOrdersBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleOrdersMy);
    }
    
    // 订单标签切换
    const tabItems = document.querySelectorAll('.tab-item-my');
    tabItems.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabType = this.getAttribute('data-tab');
            if (tabType) {
                switchTabMy(tabType);
            }
        });
    });
    
    // 联系客服按钮
    const contactBtn = document.getElementById('contactServiceBtn');
    if (contactBtn) {
        contactBtn.addEventListener('click', contactServiceMy);
    }
    
    // 模态框关闭按钮
    const modalOverlay = document.getElementById('modalOverlay');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalFooterCloseBtn = document.getElementById('modalFooterCloseBtn');
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeOrderDetailMy);
    }
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeOrderDetailMy);
    }
    if (modalFooterCloseBtn) {
        modalFooterCloseBtn.addEventListener('click', closeOrderDetailMy);
    }
    
    // 退出登录按钮
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogoutMy);
    }
    
    // 底部导航 - 返回首页
    const goHomeBtn = document.getElementById('goHomeBtn');
    if (goHomeBtn) {
        goHomeBtn.addEventListener('click', goHomeMy);
    }
}

// 检查登录状态
async function checkLoginStatusMy() {
    // 检查 URL 中是否有 token 参数（微信授权回调）
    getTokenFromUrl();
    
    // 检查是否有 Token
    if (hasToken()) {
        try {
            console.log('正在获取用户信息...');
            console.log('API_BASE_URL:', window.API_BASE_URL);
            
            // API_BASE_URL 已经包含 /api，所以直接拼接 /users/
            const apiUrl = window.API_BASE_URL + '/users/';
            console.log('请求URL:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: getAuthHeaders()
            });
            
            console.log('用户信息响应状态:', response.status);
            
            const result = await response.json();
            console.log('用户信息响应数据:', result);
            
            if (result.code === 0 && result.data) {
                const user = result.data;
                userIdMy = user.id;
                isLoggedInMy = true;
                userNameMy = user.nickname || '微信用户';
                userOpenidMy = user.openid || '';
                userAvatarMy = user.avatar || '';
                
                console.log('用户信息获取成功:', {
                    id: userIdMy,
                    nickname: userNameMy,
                    openid: userOpenidMy,
                    avatar: userAvatarMy
                });
                
                // 验证 token 中的 userId 是否匹配
                const tokenData = parseJwt(getToken());
                console.log('Token 中的用户信息:', tokenData);
                if (tokenData && tokenData.userId !== userIdMy) {
                    console.error('⚠️ 警告: Token 中的 userId 与返回的用户 ID 不匹配!');
                    console.error('Token userId:', tokenData.userId, 'API userId:', userIdMy);
                }
                
                // 更新UI
                updateUserUI();
                
                // 加载订单
                loadOrdersMy();
                return;
            } else {
                console.error('获取用户信息失败:', result.message);
                // 如果是 401 错误，说明 token 已失效
                if (response.status === 401) {
                    console.log('Token 已失效，清除登录状态');
                    removeToken();
                    // 重新发起授权
                    autoWechatLogin();
                    return;
                } else {
                    // 其他错误，显示提示但不清除 token
                    console.log('API 返回错误，但保留 token，显示未登录状态');
                    // 显示未登录状态，但不自动拉起授权
                    showNotLoggedInState();
                    return;
                }
            }
        } catch (error) {
            console.error('获取用户信息异常:', error);
            // 网络错误，不清除 token，显示未登录状态但不自动拉起授权
            console.log('网络错误，保留 token，显示未登录状态');
            showNotLoggedInState();
            return;
        }
    } else {
        console.log('未找到登录token，准备发起微信授权');
        // 自动发起微信授权登录
        autoWechatLogin();
        return;
    }
}

// 显示未登录状态（不拉起授权）
function showNotLoggedInState() {
    isLoggedInMy = false;
    document.getElementById('accountName').textContent = '微信用户';
    document.getElementById('accountOpenid').textContent = '';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('ordersSection').style.display = 'none';
}

// 更新用户UI显示
function updateUserUI() {
    console.log('更新UI显示:', {
        nickname: userNameMy,
        avatar: userAvatarMy,
        openid: userOpenidMy
    });
    
    // 更新头像
    const avatarEl = document.getElementById('userAvatar');
    if (userAvatarMy) {
        console.log('设置头像URL:', userAvatarMy);
        avatarEl.src = userAvatarMy;
        avatarEl.onerror = function() {
            console.log('头像加载失败，使用默认头像');
            this.src = '../icon/touxiang.svg';
        };
    } else {
        console.log('无头像URL，使用默认头像');
        avatarEl.src = '../icon/touxiang.svg';
    }
    
    // 更新昵称
    console.log('设置昵称:', userNameMy);
    document.getElementById('accountName').textContent = userNameMy;
    
    // 显示 openid （截断）
    if (userOpenidMy) {
        const shortOpenid = userOpenidMy.length > 20 
            ? userOpenidMy.substring(0, 10) + '...' + userOpenidMy.substring(userOpenidMy.length - 6)
            : userOpenidMy;
        document.getElementById('accountOpenid').textContent = 'ID: ' + shortOpenid;
        console.log('设置OpenID显示:', shortOpenid);
    }
    
    // 显示退出按钮和订单区
    document.getElementById('logoutBtn').style.display = 'block';
    document.getElementById('ordersSection').style.display = 'block';
    
    console.log('UI更新完成');
}

// 加载用户订单列表
async function loadOrdersMy() {
    if (!userIdMy) {
        console.log('❌ 没有用户ID，跳过加载订单');
        return;
    }
    
    ordersLoadingMy = true;
    try {
        console.log('📦 开始加载订单，用户ID:', userIdMy);
        
        // 验证 token
        const token = getToken();
        if (!token) {
            console.error('❌ 加载订单时发现 token 已丢失!');
            return;
        }
        
        const tokenData = parseJwt(token);
        console.log('Token 数据:', tokenData);
        
        const response = await getOrders(userIdMy);
        console.log('📦 订单响应:', response);
        
        if (response.code === 0) {
            ordersMy = Array.isArray(response.data) ? response.data : [];
            console.log('✅ 订单加载成功，数量:', ordersMy.length);
        } else {
            console.warn('⚠️ 订单加载失败:', response.message);
            // 不显示错误提示，避免影响用户体验
        }
        
        // 如果订单列表已展开，刷新显示
        if (showOrdersMy) {
            displayFilteredOrdersMy();
        }
    } catch (err) {
        console.error('❌ 加载订单异常:', err);
        console.trace('异常调用栈:');
        // 不显示错误提示，避免影响用户体验
    } finally {
        ordersLoadingMy = false;
        console.log('📦 订单加载流程结束');
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

// 自动微信登录
function autoWechatLogin() {
    // 检查是否在微信浏览器中
    if (!isWeChatBrowser()) {
        console.log('不在微信浏览器中，无法自动登录');
        showToast('请在微信中打开');
        showNotLoggedInState();
        return;
    }
    
    // 检查URL参数，避免授权失败后的无限循环
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error')) {
        console.log('授权失败，不再自动发起授权');
        showToast('授权失败: ' + urlParams.get('error'));
        showNotLoggedInState();
        return;
    }
    
    // 检查是否刚刚完成过授权（防止重复授权）
    const lastAuthTime = sessionStorage.getItem('last_auth_time');
    if (lastAuthTime) {
        const timeDiff = Date.now() - parseInt(lastAuthTime);
        // 5秒内不重复授权
        if (timeDiff < 5000) {
            console.log('刚刚完成授权，跳过自动授权');
            showNotLoggedInState();
            return;
        }
    }
    
    // 记录授权时间
    sessionStorage.setItem('last_auth_time', Date.now().toString());
    
    console.log('🔐 自动发起微信授权登录');
    // 发起微信授权（获取用户信息）
    wechatAuth('snsapi_userinfo', '/pages/my.html');
}

// 处理登出
function handleLogoutMy() {
    console.log('🚪 执行退出登录操作');
    console.trace('退出登录调用栈:');
    
    // 清除登录状态
    userLogout();
    
    // 停止轮询
    stopOrderPolling();
    
    // 重置状态
    isLoggedInMy = false;
    userNameMy = '';
    userOpenidMy = '';
    userAvatarMy = '';
    userIdMy = null;
    ordersMy = [];
    showOrdersMy = false;
    currentTabMy = 'all';
    
    // 更新UI
    document.getElementById('userAvatar').src = '../icon/touxiang.svg';
    document.getElementById('accountName').textContent = '微信用户';
    document.getElementById('accountOpenid').textContent = '';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('ordersSection').style.display = 'none';
    
    showToast('已退出登录');
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

// 将需要在 HTML 中使用的函数暴露到全局作用域
window.showOrderDetailMy = showOrderDetailMy;
