// 管理后台 JS

let currentPage = 'dashboard';
let ordersCurrentPage = 1;
let usersCurrentPage = 1;
let currentUserId = null;

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
});

// 检查管理员权限
async function checkAdminAuth() {
    if (!hasToken()) {
        showToast('请先登录');
        setTimeout(() => {
            window.location.href = 'login.html?return=' + encodeURIComponent(window.location.href);
        }, 1000);
        return;
    }
    
    let userInfo = getUserInfo();
    
    // 如果本地没有role信息，重新刷新
    if (!userInfo || !userInfo.role) {
        userInfo = await refreshUserInfo();
    }
    
    // 检查用户角色
    if (!userInfo || userInfo.role !== 'admin') {
        showToast('权限不足，仅管理员可访问');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
        return;
    }
    
    if (userInfo) {
        document.getElementById('adminName').textContent = userInfo.nickname || '管理员';
    }
    
    // 验证管理员权限 - 尝试访问管理员接口
    try {
        const response = await fetch('http://localhost:3000/api/admin/dashboard/stats', {
            headers: getAuthHeaders()
        });
        
        if (response.status === 403) {
            // 权限不足
            showToast('权限不足，仅管理员可访问');
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
            return;
        }
        
        if (response.status === 401) {
            // Token无效
            showToast('登录已过期，请重新登录');
            setTimeout(() => {
                window.location.href = 'login.html?return=' + encodeURIComponent(window.location.href);
            }, 1000);
            return;
        }
        
        // 权限验证通过，加载首页数据
        const data = await response.json();
        if (data.code === 0) {
            loadDashboard();
        }
    } catch (error) {
        console.error('权限验证失败:', error);
        showToast('系统错误，请稍后重试');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
    }
}

// 切换页面
function switchPage(page) {
    // 更新导航样式
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // 隐藏所有页面
    document.querySelectorAll('.admin-page').forEach(p => {
        p.style.display = 'none';
    });
    
    // 显示选中页面
    document.getElementById(`page-${page}`).style.display = 'block';
    currentPage = page;
    
    // 加载数据
    if (page === 'dashboard') {
        loadDashboard();
    } else if (page === 'orders') {
        loadOrders();
    } else if (page === 'users') {
        loadUsers();
    } else if (page === 'logs') {
        loadLogs();
    } else if (page === 'config') {
        loadConfig();
    } else if (page === 'presets') {
        loadPresets();
    }
}

// ==================== 数据概览 ====================

async function loadDashboard() {
    try {
        const response = await fetch('http://localhost:3000/api/admin/dashboard/stats', {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.code === 0) {
            const stats = data.data;
            
            // 更新统计卡片
            document.getElementById('stat-users').textContent = stats.users.total;
            document.getElementById('stat-orders').textContent = stats.orders.total;
            document.getElementById('stat-revenue').textContent = `¥${stats.orders.totalRevenue.toFixed(2)}`;
            document.getElementById('stat-today').textContent = stats.today.orders;
            
            // 渲染订单状态图表
            renderStatusChart(stats.orders);
            
            // 渲染业务类型图表
            renderTypeChart(stats.typeDistribution);
        } else if (response.status === 403) {
            showToast('权限不足，仅管理员可访问');
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
        showToast('加载失败');
    }
}

function renderStatusChart(orders) {
    const chart = document.getElementById('order-status-chart');
    const total = orders.total;
    
    chart.innerHTML = `
        <div style="margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>待处理</span>
                <span>${orders.pending} (${(orders.pending/total*100).toFixed(1)}%)</span>
            </div>
            <div style="height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
                <div style="width: ${orders.pending/total*100}%; height: 100%; background: #fbbf24;"></div>
            </div>
        </div>
        <div style="margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>处理中</span>
                <span>${orders.processing} (${(orders.processing/total*100).toFixed(1)}%)</span>
            </div>
            <div style="height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
                <div style="width: ${orders.processing/total*100}%; height: 100%; background: #3b82f6;"></div>
            </div>
        </div>
        <div style="margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>已完成</span>
                <span>${orders.completed} (${(orders.completed/total*100).toFixed(1)}%)</span>
            </div>
            <div style="height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
                <div style="width: ${orders.completed/total*100}%; height: 100%; background: #10b981;"></div>
            </div>
        </div>
        <div style="margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>已失败</span>
                <span>${orders.failed} (${(orders.failed/total*100).toFixed(1)}%)</span>
            </div>
            <div style="height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
                <div style="width: ${orders.failed/total*100}%; height: 100%; background: #ef4444;"></div>
            </div>
        </div>
    `;
}

function renderTypeChart(types) {
    const chart = document.getElementById('order-type-chart');
    const typeLabels = { sms: '短信', call: '电话', human: '人工' };
    const colors = { sms: '#3b82f6', call: '#10b981', human: '#f59e0b' };
    
    const total = types.reduce((sum, t) => sum + t.count, 0);
    
    chart.innerHTML = types.map(type => {
        const revenue = parseFloat(type.revenue) || 0;
        return `
        <div style="margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>${typeLabels[type.type]}</span>
                <span>${type.count} (¥${revenue.toFixed(2)})</span>
            </div>
            <div style="height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
                <div style="width: ${type.count/total*100}%; height: 100%; background: ${colors[type.type]};"></div>
            </div>
        </div>
    `}).join('');
}

// ==================== 订单管理 ====================

async function loadOrders(page = 1) {
    ordersCurrentPage = page;
    const status = document.getElementById('filter-status').value;
    const type = document.getElementById('filter-type').value;
    
    try {
        let url = `http://localhost:3000/api/admin/orders?page=${page}&limit=20`;
        if (status) url += `&status=${status}`;
        if (type) url += `&type=${type}`;
        
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.code === 0) {
            renderOrdersTable(data.data.orders);
            renderPagination('orders', data.data.pagination);
        } else {
            console.error('订单接口返回错误:', data);
            showToast(data.message || '加载失败');
        }
    } catch (error) {
        console.error('加载订单失败:', error);
        showToast('加载失败');
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-tbody');
    const typeLabels = { sms: '短信', call: '电话', human: '人工' };
    const statusLabels = { pending: '待处理', processing: '处理中', completed: '已完成', failed: '已失败' };
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 40px;">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.user_phone || '-'}</td>
            <td>${typeLabels[order.type]}</td>
            <td><span class="status-badge status-${order.status}">${statusLabels[order.status]}</span></td>
            <td>¥${order.price}</td>
            <td>${order.contact_phone || '-'}</td>
            <td>${formatDate(order.created_at)}</td>
            <td>
                <button class="action-btn action-btn-primary" onclick="viewOrder(${order.id})">查看</button>
                <button class="action-btn" onclick="updateOrderStatus(${order.id}, 'completed')">完成</button>
                <button class="action-btn action-btn-danger" onclick="deleteOrder(${order.id})">删除</button>
            </td>
        </tr>
    `).join('');
}

async function viewOrder(id) {
    try {
        const response = await fetch(`http://localhost:3000/api/admin/orders/${id}`, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.code === 0) {
            const order = data.data;
            console.log('订单数据:', order);
            const modal = document.getElementById('order-modal');
            const body = document.getElementById('order-modal-body');
            
            body.innerHTML = `
                <div class="form-group">
                    <label>订单ID</label>
                    <input type="text" value="#${order.id}" readonly>
                </div>
                <div class="form-group">
                    <label>订单状态</label>
                    <select id="order-status-edit">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>待处理</option>
                        <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>处理中</option>
                        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>已完成</option>
                        <option value="failed" ${order.status === 'failed' ? 'selected' : ''}>已失败</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>虚拟号码</label>
                    <input type="text" id="order-virtual-number" value="${order.virtual_number || ''}" placeholder="分配虚拟号码">
                </div>
                <div class="form-group">
                    <label>联系方式</label>
                    <input type="text" value="${order.contact_phone || ''}" readonly>
                </div>
                <div class="form-group">
                    <label>服务内容</label>
                    <textarea readonly style="width:100%; min-height: 100px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px;">${order.content || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <input type="text" id="order-remark-edit" value="${order.remark || ''}" placeholder="添加备注">
                </div>
                <button class="btn-primary" onclick="saveOrderChanges(${order.id})" style="width: 100%; margin-top: 12px;">保存更改</button>
            `;
            
            console.log('模态框内容已设置');
            modal.classList.add('show');
            console.log('模态框已显示');
        } else {
            console.error('查看订单失败:', data);
            showToast(data.message || '加载失败');
        }
    } catch (error) {
        console.error('查看订单失败:', error);
        showToast('加载失败');
    }
}

async function saveOrderChanges(id) {
    const status = document.getElementById('order-status-edit').value;
    const virtualNumber = document.getElementById('order-virtual-number').value;
    const remark = document.getElementById('order-remark-edit').value;
    
    try {
        const response = await fetch(`http://localhost:3000/api/admin/orders/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status, virtual_number: virtualNumber, remark })
        });
        
        const data = await response.json();
        
        if (data.code === 0) {
            showToast('更新成功');
            closeOrderModal();
            loadOrders(ordersCurrentPage);
        } else {
            showToast(data.message || '更新失败');
        }
    } catch (error) {
        console.error('更新订单失败:', error);
        showToast('更新失败');
    }
}

async function updateOrderStatus(id, status) {
    if (!confirm(`确认将订单状态改为"${status}"吗？`)) return;
    
    try {
        const response = await fetch(`http://localhost:3000/api/admin/orders/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status })
        });
        
        const data = await response.json();
        
        if (data.code === 0) {
            showToast('更新成功');
            loadOrders(ordersCurrentPage);
        } else {
            console.error('更新订单状态失败:', data);
            showToast(data.message || '更新失败');
        }
    } catch (error) {
        console.error('更新失败:', error);
        showToast('更新失败');
    }
}

async function deleteOrder(id) {
    // 第一次确认
    if (!confirm('⚠️ 警告：确认删除此订单吗？\n\n删除后数据将无法恢复！')) return;
    
    // 第二次确认（更明确的提示）
    const confirmText = prompt('为确保安全，请输入 "DELETE" 来确认删除操作：');
    if (confirmText !== 'DELETE') {
        showToast('删除操作已取消');
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:3000/api/admin/orders/${id}`, {
            method: 'DELETE',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ confirm: true }) // 后端需要的确认参数
        });
        
        const data = await response.json();
        
        if (data.code === 0) {
            showToast('删除成功');
            loadOrders(ordersCurrentPage);
        } else {
            showToast(data.message || '删除失败');
        }
    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败，请重试');
    }
}

function closeOrderModal() {
    document.getElementById('order-modal').classList.remove('show');
}

// ==================== 用户管理 ====================

async function loadUsers(page = 1) {
    usersCurrentPage = page;
    const search = document.getElementById('search-user').value;
    
    try {
        let url = `http://localhost:3000/api/admin/users?page=${page}&limit=20`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.code === 0) {
            renderUsersTable(data.data.users);
            renderPagination('users', data.data.pagination);
        }
    } catch (error) {
        console.error('加载用户失败:', error);
        showToast('加载失败');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-tbody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px;">暂无数据</td></tr>';
        return;
    }
    
    // 获取当前登录用户ID
    const currentUserId = JSON.parse(localStorage.getItem('userInfo'))?.id;
    
    tbody.innerHTML = users.map(user => {
        const balance = parseFloat(user.balance) || 0;
        const isSuperAdmin = user.is_super_admin === 1;
        const isCurrentUser = user.id === currentUserId;
        const canModify = !isSuperAdmin && !isCurrentUser;
        
        let roleLabel = user.role === 'admin' ? '管理员' : '用户';
        if (isSuperAdmin) roleLabel = '超级管理员';
        
        return `
        <tr>
            <td>#${user.id}</td>
            <td>${user.phone || '-'}</td>
            <td>${user.nickname || '-'}</td>
            <td>¥${balance.toFixed(2)}</td>
            <td>${roleLabel}</td>
            <td>${formatDate(user.created_at)}</td>
            <td style="text-align: left;">
                ${canModify ? `<button class="action-btn ${user.role === 'admin' ? 'action-btn-danger' : 'action-btn-primary'}" onclick="toggleRole(${user.id}, '${user.role}')">${user.role === 'admin' ? '取消管理员' : '设为管理员'}</button>` : '<span style="color: #9ca3af; font-size: 12px;">不可操作</span>'}
            </td>
        </tr>
    `}).join('');
}



async function toggleRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const action = newRole === 'admin' ? '设为管理员' : '取消管理员权限';
    
    if (!confirm(`确认${action}吗？`)) return;
    
    try {
        const response = await fetch(`http://localhost:3000/api/admin/users/${userId}/role`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ role: newRole })
        });
        
        const data = await response.json();
        
        if (data.code === 0) {
            showToast('角色更新成功');
            loadUsers(usersCurrentPage);
        } else {
            showToast(data.message || '更新失败');
        }
    } catch (error) {
        console.error('更新角色失败:', error);
        showToast('更新失败');
    }
}

function handleSearchUser(event) {
    if (event.key === 'Enter') {
        loadUsers(1);
    }
}

// ==================== 系统配置 ====================

async function loadConfig() {
    try {
        const prices = await getPrices();
        document.getElementById('price-sms').value = prices.sms;
        document.getElementById('price-call').value = prices.call;
        document.getElementById('price-human').value = prices.human;
    } catch (error) {
        console.error('加载配置失败:', error);
    }
}

function savePrices() {
    const sms = document.getElementById('price-sms').value;
    const call = document.getElementById('price-call').value;
    const human = document.getElementById('price-human').value;
    
    showToast('请手动编辑 backend/routes/config.js 文件并重启服务器');
    
    console.log('新价格配置:', { sms, call, human });
}

// ==================== 分页 ====================

function renderPagination(type, pagination) {
    const container = document.getElementById(`${type}-pagination`);
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    
    let html = '';
    
    // 上一页
    html += `<button ${pagination.page === 1 ? 'disabled' : ''} onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${pagination.page - 1})">上一页</button>`;
    
    // 页码
    for (let i = 1; i <= Math.min(totalPages, 10); i++) {
        html += `<button class="${i === pagination.page ? 'active' : ''}" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${i})">${i}</button>`;
    }
    
    // 下一页
    html += `<button ${pagination.page === totalPages ? 'disabled' : ''} onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${pagination.page + 1})">下一页</button>`;
    
    container.innerHTML = html;
}

// ==================== 访问日志 ====================

let logsCurrentPage = 1;

async function loadLogs(page = 1) {
    logsCurrentPage = page;
    const days = document.getElementById('filter-days')?.value || '7';
    const userId = document.getElementById('filter-admin')?.value || '';

    try {
        let url = `http://localhost:3000/api/admin/logs/access?page=${page}&limit=50&days=${days}`;
        if (userId) url += `&user_id=${userId}`;

        const response = await fetch(url, {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.code === 0) {
            renderLogsTable(data.data.logs);
            renderPagination('logs', data.data.pagination);
            loadLogsStats();
        } else {
            console.error('加载日志失败:', data);
            showToast(data.message || '加载失败');
        }
    } catch (error) {
        console.error('加载日志失败:', error);
        showToast('加载失败');
    }
}

function renderLogsTable(logs) {
    const tbody = document.getElementById('logs-tbody');

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px;">暂无日志</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(log => `
        <tr>
            <td>${formatDate(log.created_at)}</td>
            <td>${log.user_nickname || '-'}</td>
            <td>${log.user_phone || '-'}</td>
            <td style="font-family: monospace; font-size: 12px; color: #6b7280;">${log.endpoint}</td>
            <td><span class="method-badge method-${log.method}">${log.method}</span></td>
            <td><span class="status-badge status-${log.status_code >= 400 ? 'error' : 'success'}">${log.status_code}</span></td>
            <td>${log.ip_address}</td>
        </tr>
    `).join('');
}

async function loadLogsStats() {
    try {
        const response = await fetch('http://localhost:3000/api/admin/logs/stats', {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.code === 0) {
            const stats = data.data;
            
            // 计算总访问次数
            const totalAccess = stats.adminStats.reduce((sum, s) => sum + s.access_count, 0);
            document.getElementById('stat-total-access').textContent = totalAccess;
            
            // 活跃管理员数
            document.getElementById('stat-active-admins').textContent = stats.adminStats.length;
            
            // 最高访问端点
            if (stats.endpointStats.length > 0) {
                const topEndpoint = stats.endpointStats[0].endpoint;
                document.getElementById('stat-top-endpoint').textContent = topEndpoint.substring(0, 30);
            }

            // 填充管理员下拉框
            const adminSelect = document.getElementById('filter-admin');
            const currentValue = adminSelect.value;
            adminSelect.innerHTML = '<option value="">全部管理员</option>';
            stats.adminStats.forEach(admin => {
                const option = document.createElement('option');
                option.value = admin.user_id;
                option.textContent = `${admin.user_nickname || '未知'} (${admin.user_phone || '-'})`;
                adminSelect.appendChild(option);
            });
            adminSelect.value = currentValue;
        }
    } catch (error) {
        console.error('加载日志统计失败:', error);
    }
}

function exportLogs() {
    const days = document.getElementById('filter-days')?.value || '7';
    const logs = Array.from(document.querySelectorAll('#logs-tbody tr')).map(row => {
        const cells = row.querySelectorAll('td');
        return {
            时间: cells[0]?.textContent || '',
            管理员: cells[1]?.textContent || '',
            手机号: cells[2]?.textContent || '',
            操作: cells[3]?.textContent || '',
            方法: cells[4]?.textContent || '',
            状态: cells[5]?.textContent || '',
            'IP地址': cells[6]?.textContent || ''
        };
    });

    if (logs.length === 0) {
        showToast('没有日志可导出');
        return;
    }

    // 转换为 CSV
    const headers = Object.keys(logs[0]);
    const csvContent = [
        headers.join(','),
        ...logs.map(log => headers.map(h => `"${log[h] || ''}"`).join(','))
    ].join('\n');

    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `admin-logs-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('日志已导出');
}

// 清理旧日志
async function cleanupLogs() {
    const days = prompt('请输入要保留的天数（最少7天）:', '30');
    
    if (!days) return;
    
    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum < 7) {
        showToast('保留天数必须是数字且不能少于7天');
        return;
    }
    
    if (!confirm(`确认删除 ${daysNum} 天之前的日志吗？此操作不可恢复！`)) {
        return;
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/admin/logs/cleanup', {
            method: 'DELETE',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ days: daysNum })
        });
        
        const result = await response.json();
        
        if (result.code === 0) {
            showToast(`成功清理 ${result.data.deletedCount} 条日志`);
            loadLogs(1); // 重新加载日志列表
        } else {
            showToast(result.message || '清理失败');
        }
    } catch (error) {
        console.error('清理日志失败:', error);
        showToast('清理失败，请重试');
    }
}

// ==================== 工具函数 ====================

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
}

function handleLogout() {
    if (confirm('确认退出管理后台吗？')) {
        userLogout();
        window.location.href = '../index.html';
    }
}

// ==================== 预设文案管理 ====================

let currentPresetId = null;
let allCategories = ['复合', '告别', '表白', '祝福'];

// 加载预设文案
async function loadPresets() {
    const type = 'sms';
    const category = document.getElementById('preset-category-filter').value;
    const container = document.getElementById('presets-grid');
    
    try {
        let url = `http://localhost:3000/api/presets?type=${type}`;
        if (category) {
            url += `&category=${encodeURIComponent(category)}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.code === 0 && result.data) {
            container.innerHTML = '';
            
            let hasData = false;
            result.data.forEach(group => {
                group.items.forEach(item => {
                    hasData = true;
                    const card = createPresetCard({
                        id: item.id,
                        type: type,
                        category: group.category,
                        title: item.title,
                        content: item.content
                    });
                    container.appendChild(card);
                });
            });
            
            if (!hasData) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <div class="empty-state-text">暂无文案数据</div>
                    </div>
                `;
            }
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <div class="empty-state-text">加载失败</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('加载预设文案失败:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-text">加载失败，请重试</div>
            </div>
        `;
    }
}

// 创建预设文案卡片
function createPresetCard(preset) {
    const card = document.createElement('div');
    card.className = 'preset-card';
    
    card.innerHTML = `
        <div class="preset-card-header">
            <div>
                <span class="preset-card-category">${preset.category}</span>
            </div>
        </div>
        <div class="preset-card-content">${preset.content}</div>
        <div class="preset-card-actions">
            <button class="btn-edit-preset" onclick="editPreset(${preset.id})">✏️ 编辑</button>
            <button class="btn-delete-preset" onclick="deletePreset(${preset.id})">🗑️ 删除</button>
        </div>
    `;
    
    return card;
}

// 显示添加文案模态框
function showAddPresetModal() {
    currentPresetId = null;
    document.getElementById('preset-modal-title').textContent = '添加文案';
    document.getElementById('preset-type').value = 'sms';
    document.getElementById('preset-category').value = '';
    document.getElementById('preset-content').value = '';
    
    // 更新分类选项
    updateCategoryOptions();
    
    document.getElementById('preset-modal').style.display = 'flex';
}

// 编辑文案
async function editPreset(id) {
    currentPresetId = id;
    
    try {
        const response = await fetch(`http://localhost:3000/api/presets/${id}`, {
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.code === 0 && result.data) {
            const preset = result.data;
            document.getElementById('preset-modal-title').textContent = '编辑文案';
            document.getElementById('preset-type').value = preset.type;
            document.getElementById('preset-category').value = preset.category;
            document.getElementById('preset-content').value = preset.content;
            
            updateCategoryOptions();
            
            document.getElementById('preset-modal').style.display = 'flex';
        } else {
            showToast('加载文案失败');
        }
    } catch (error) {
        console.error('加载文案失败:', error);
        showToast('加载文案失败，请重试');
    }
}

// 保存文案
async function savePreset() {
    const type = document.getElementById('preset-type').value;
    const category = document.getElementById('preset-category').value;
    const content = document.getElementById('preset-content').value;
    
    if (!category || !content) {
        showToast('请填写完整信息');
        return;
    }
    
    try {
        let url, method;
        if (currentPresetId) {
            url = `http://localhost:3000/api/presets/${currentPresetId}`;
            method = 'PUT';
        } else {
            url = 'http://localhost:3000/api/presets';
            method = 'POST';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, category, content })
        });
        
        const result = await response.json();
        
        if (result.code === 0) {
            showToast(currentPresetId ? '更新成功' : '添加成功');
            closePresetModal();
            loadPresets();
        } else {
            showToast(result.message || '操作失败');
        }
    } catch (error) {
        console.error('保存文案失败:', error);
        showToast('操作失败，请重试');
    }
}

// 删除文案
async function deletePreset(id) {
    if (!confirm('⚠️ 确定要删除这条文案吗？删除后无法恢复！')) {
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:3000/api/presets/${id}`, {
            method: 'DELETE',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ confirm: true }) // 后端需要的确认参数
        });
        
        const result = await response.json();
        
        if (result.code === 0) {
            showToast('删除成功');
            loadPresets();
        } else {
            showToast(result.message || '删除失败');
        }
    } catch (error) {
        console.error('删除文案失败:', error);
        showToast('删除失败，请重试');
    }
}

// 关闭文案模态框
function closePresetModal() {
    document.getElementById('preset-modal').style.display = 'none';
    currentPresetId = null;
}

// 显示添加分类模态框
function showAddCategoryModal() {
    document.getElementById('new-category-name').value = '';
    document.getElementById('category-modal').style.display = 'flex';
}

// 添加新分类
function addCategory() {
    const categoryName = document.getElementById('new-category-name').value.trim();
    
    if (!categoryName) {
        showToast('请输入分类名称');
        return;
    }
    
    if (allCategories.includes(categoryName)) {
        showToast('该分类已存在');
        return;
    }
    
    allCategories.push(categoryName);
    updateCategoryOptions();
    closeCategoryModal();
    showToast('分类添加成功');
}

// 更新分类选项
function updateCategoryOptions() {
    const select = document.getElementById('preset-category');
    const filter = document.getElementById('preset-category-filter');
    
    // 更新编辑框中的分类选项
    select.innerHTML = '';
    allCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
    
    // 更新筛选器中的分类选项
    const currentFilterValue = filter.value;
    filter.innerHTML = '<option value="">全部分类</option>';
    allCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        filter.appendChild(option);
    });
    filter.value = currentFilterValue;
}

// 关闭分类模态框
function closeCategoryModal() {
    document.getElementById('category-modal').style.display = 'none';
}

