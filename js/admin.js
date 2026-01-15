// 导入依赖
import './config.js';
import apiClient from './api-client.js';
import { showToast } from './common.js';

// ==================== 全局变量 ====================
// API 基础URL - 生产环境应该设置 window.API_BASE_URL
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';
let adminToken = localStorage.getItem('adminToken');
let currentOrderPage = 1;
let currentUserPage = 1;
let currentOrdersData = [];
let currentUsersData = [];
let selectedUserId = null;

// ==================== 页面初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化 API Client（获取 CSRF Token）
  try {
    await apiClient.init();
  } catch (error) {
    console.error('初始化 API Client 失败:', error);
  }
  
  // 从 localStorage 重新加载 token（确保最新）
  adminToken = localStorage.getItem('adminToken');
  
  if (adminToken) {
    showMainPage();
  } else {
    showLoginPage();
  }
  
  initEventListeners();
});

function initEventListeners() {
  // 登录表单
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', handleLogin);
  
  // 导航菜单
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      switchPage(page);
      
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
    });
  });
  
  // 退出登录
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  
  // 订单管理
  document.getElementById('orderSearch').addEventListener('keyup', () => {
    currentOrderPage = 1;
    loadOrders();
  });
  document.getElementById('orderTypeFilter').addEventListener('change', () => {
    currentOrderPage = 1;
    loadOrders();
  });
  document.getElementById('orderStatusFilter').addEventListener('change', () => {
    currentOrderPage = 1;
    loadOrders();
  });
  
  // 用户管理
  document.getElementById('userSearch').addEventListener('keyup', () => {
    currentUserPage = 1;
    loadUsers();
  });
  
  // 分页
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentOrderPage > 1) {
      currentOrderPage--;
      loadOrders();
    }
  });
  document.getElementById('nextPage').addEventListener('click', () => {
    currentOrderPage++;
    loadOrders();
  });
  
  document.getElementById('userPrevPage').addEventListener('click', () => {
    if (currentUserPage > 1) {
      currentUserPage--;
      loadUsers();
    }
  });
  document.getElementById('userNextPage').addEventListener('click', () => {
    currentUserPage++;
    loadUsers();
  });
  
  // 设置页面
  document.getElementById('savePricesBtn').addEventListener('click', savePrices);
  document.getElementById('exportBtn').addEventListener('click', exportOrderData);
  
  // 模态框关闭按钮
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) {
        modal.classList.remove('active');
      }
    });
  });
  
  // 点击背景关闭模态框
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
  
  // 如果已登录，初始化加载仪表盘
  if (adminToken) {
    loadDashboardData();
  }
}

// ==================== 登录相关 ====================
async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  
  if (!username || !password) {
    showError('loginError', '用户名和密码不能为空');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      adminToken = data.data.token;
      localStorage.setItem('adminToken', adminToken);
      document.getElementById('adminName').textContent = data.data.admin.username;
      showMainPage();
      // 登录成功后加载仪表盘数据
      loadDashboardData();
    } else {
      showError('loginError', data.message || '登录失败');
    }
  } catch (err) {
    console.error('登录出错:', err);
    showError('loginError', '网络错误，请稍后重试');
  }
}

function handleLogout() {
  if (confirm('确定要退出登录吗？')) {
    localStorage.removeItem('adminToken');
    adminToken = null;
    document.getElementById('loginForm').reset();
    showLoginPage();
  }
}

function showLoginPage() {
  document.getElementById('loginPage').classList.add('active');
  document.getElementById('mainPage').classList.remove('active');
}

function showMainPage() {
  document.getElementById('loginPage').classList.remove('active');
  document.getElementById('mainPage').classList.add('active');
  // 默认切换到仪表盘页面
  switchPage('dashboard');
}

// ==================== 页面切换 ====================
function switchPage(page) {
  const pages = document.querySelectorAll('.content-page');
  pages.forEach(p => p.classList.remove('active'));
  
  const targetPage = document.getElementById(page + 'Page');
  if (targetPage) {
    targetPage.classList.add('active');
    
    // 触发数据加载
    if (page === 'dashboard') {
      loadDashboardData();
    } else if (page === 'orders') {
      currentOrderPage = 1;
      loadOrders();
    } else if (page === 'users') {
      currentUserPage = 1;
      loadUsers();
    }
  }
}

// ==================== 仪表盘数据 ====================
async function loadDashboardData() {
  try {
    if (!adminToken) {
      console.error('未找到管理员token，请重新登录');
      handleLogout();
      return;
    }
    
    const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      headers: getAuthHeaders()
    });
    
    const data = await response.json();
    
    if (response.status === 401) {
      console.error('Token无效或已过期，请重新登录');
      alert('登录已过期，请重新登录');
      handleLogout();
      return;
    }
    
    if (data.code === 0) {
      const summary = data.data.summary;
      
      // 确保数值类型正确
      const totalRevenue = parseFloat(summary.total_revenue) || 0;
      const dailyRevenue = parseFloat(summary.daily_revenue) || 0;
      const totalOrders = parseInt(summary.total_orders) || 0;
      
      document.getElementById('totalUsers').textContent = summary.total_users || 0;
      document.getElementById('newUsers').textContent = summary.new_users || 0;
      document.getElementById('totalOrders').textContent = totalOrders;
      document.getElementById('newOrders').textContent = summary.new_orders || 0;
      document.getElementById('totalRevenue').textContent = `¥${totalRevenue.toFixed(2)}`;
      document.getElementById('dailyRevenue').textContent = `¥${dailyRevenue.toFixed(2)}`;
      
      // 计算平均客单价
      const avgValue = totalOrders > 0 
        ? (totalRevenue / totalOrders).toFixed(2)
        : '0.00';
      document.getElementById('avgOrderValue').textContent = `¥${avgValue}`;
      
      // 渲染图表
      renderTypeChart(data.data.order_type_distribution || {});
      renderStatusChart(data.data.order_status_distribution || {});
      renderTrendTable(data.data.order_trend || []);
    }
  } catch (err) {
    console.error('加载仪表盘数据出错:', err);
  }
}

function renderTypeChart(data) {
  if (!data || Object.keys(data).length === 0) {
    document.getElementById('typeChart').innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">暂无数据</div>';
    return;
  }
  
  const chartHtml = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${Object.entries(data).map(([type, count]) => {
        const typeLabels = { sms: '传话短信', call: '和解电话', human: '人工传话' };
        const safeCount = parseInt(count) || 0;
        return `
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>${typeLabels[type] || type}</span>
              <span style="font-weight: 600;">${safeCount}</span>
            </div>
            <div style="height: 24px; background-color: #f3f4f6; border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; background-color: #667eea; width: ${Math.min(safeCount * 10, 100)}%; transition: width 0.3s;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  document.getElementById('typeChart').innerHTML = chartHtml;
}

function renderStatusChart(data) {
  if (!data || Object.keys(data).length === 0) {
    document.getElementById('statusChart').innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">暂无数据</div>';
    return;
  }
  
  const chartHtml = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${Object.entries(data).map(([status, count]) => {
        const statusLabels = { 
          pending: '待处理', 
          processing: '处理中', 
          completed: '已完成', 
          failed: '已失败' 
        };
        const colors = {
          pending: '#fbbf24',
          processing: '#60a5fa',
          completed: '#34d399',
          failed: '#f87171'
        };
        const safeCount = parseInt(count) || 0;
        return `
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>${statusLabels[status] || status}</span>
              <span style="font-weight: 600;">${safeCount}</span>
            </div>
            <div style="height: 24px; background-color: #f3f4f6; border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; background-color: ${colors[status]}; width: ${Math.min(safeCount * 10, 100)}%; transition: width 0.3s;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  document.getElementById('statusChart').innerHTML = chartHtml;
}

function renderTrendTable(data) {
  const tbody = document.getElementById('trendTableBody');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #999; padding: 20px;">暂无数据</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(item => {
    // 格式化日期为中文格式
    const date = new Date(item.date);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    const formattedDate = `${month}月${day}日 ${weekday}`;
    
    return `
      <tr>
        <td>${formattedDate}</td>
        <td><strong>${item.count}</strong></td>
      </tr>
    `;
  }).join('');
}

// ==================== 订单管理 ====================
async function loadOrders() {
  try {
    const searchValue = document.getElementById('orderSearch').value.trim();
    const typeFilter = document.getElementById('orderTypeFilter').value;
    const statusFilter = document.getElementById('orderStatusFilter').value;
    
    let query = `?page=${currentOrderPage}&pageSize=20`;
    if (typeFilter) query += `&type=${typeFilter}`;
    if (statusFilter) query += `&status=${statusFilter}`;
    
    const response = await fetch(`${API_BASE_URL}/admin/orders${query}`, {
      headers: getAuthHeaders()
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      currentOrdersData = data.data.orders;
      renderOrdersTable(data.data.orders);
      updatePagination(
        data.data.pagination,
        'ordersPagination',
        'pageInfo',
        'prevPage',
        'nextPage'
      );
    }
  } catch (err) {
    console.error('加载订单出错:', err);
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">暂无订单</td></tr>';
    return;
  }
  
  tbody.innerHTML = orders.map(order => {
    const price = parseFloat(order.price) || 0;
    return `
      <tr>
        <td><strong>#${order.id}</strong></td>
        <td>${order.user_id}</td>
        <td>${getTypeLabel(order.type)}</td>
        <td>${order.contact_phone || '-'}</td>
        <td>¥${price.toFixed(2)}</td>
        <td><span class="status-badge status-${order.status}">${getStatusLabel(order.status)}</span></td>
        <td>${formatDate(order.created_at)}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn" onclick="showOrderDetail(${order.id})">详情</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function showOrderDetail(orderId) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, {
      headers: getAuthHeaders()
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      const order = data.data;
      const body = document.getElementById('orderDetailBody');
      const price = parseFloat(order.price) || 0;
      
      body.innerHTML = `
        <div style="display: grid; gap: 16px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">订单ID</div>
              <div style="font-weight: 600; font-size: 16px;">#${order.id}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">用户ID</div>
              <div style="font-weight: 600;">${order.user_id}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">订单类型</div>
              <div style="font-weight: 600;">${getTypeLabel(order.type)}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">订单状态</div>
              <div><span class="status-badge status-${order.status}">${getStatusLabel(order.status)}</span></div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">订单金额</div>
              <div style="font-weight: 600; color: #ef4444; font-size: 18px;">¥${price.toFixed(2)}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">联系电话</div>
              <div style="font-weight: 600;">${order.contact_phone || '-'}</div>
            </div>
          </div>
          <div>
            <div style="color: #999; font-size: 12px; margin-bottom: 4px;">联系方式</div>
            <div style="font-weight: 600;">${order.contact_method || '-'}</div>
          </div>
          <div>
            <div style="color: #999; font-size: 12px; margin-bottom: 4px;">服务内容</div>
            <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; line-height: 1.6; word-break: break-all;">
              ${order.content || '（无内容）'}
            </div>
          </div>
          ${order.scheduled_time ? `
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">计划时间</div>
              <div style="font-weight: 600;">${formatDateTime(order.scheduled_time)}</div>
            </div>
          ` : ''}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">创建时间</div>
              <div>${formatDateTime(order.created_at)}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">更新时间</div>
              <div>${formatDateTime(order.updated_at)}</div>
            </div>
          </div>
          ${order.remark ? `
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">备注</div>
              <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px;">
                ${order.remark}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      
      // 渲染操作按钮
      const actions = document.getElementById('orderActions');
      if (order.status !== 'completed' && order.status !== 'failed') {
        actions.innerHTML = `
          <select id="newStatus" class="form-control" style="flex: 1; margin-right: 12px;">
            <option value="">选择新状态</option>
            <option value="processing">处理中</option>
            <option value="completed">已完成</option>
            <option value="failed">已失败</option>
          </select>
          <button class="btn btn-primary" onclick="updateOrderStatus(${orderId})">更新状态</button>
        `;
      } else {
        actions.innerHTML = '<span style="color: #999;">该订单已终止，无法修改状态</span>';
      }
      
      document.getElementById('orderDetailModal').classList.add('active');
    }
  } catch (err) {
    console.error('加载订单详情出错:', err);
  }
}

async function updateOrderStatus(orderId) {
  const status = document.getElementById('newStatus').value;
  if (!status) {
    alert('请选择新状态');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      closeModal('orderDetailModal');
      loadOrders();
    } else {
      alert(data.message || '更新失败');
    }
  } catch (err) {
    console.error('更新订单状态出错:', err);
    alert('网络错误');
  }
}

// ==================== 用户管理 ====================
async function loadUsers() {
  try {
    const searchValue = document.getElementById('userSearch').value.trim();
    let query = `?page=${currentUserPage}&pageSize=20`;
    if (searchValue) {
      // 检查是否是电话号码
      if (/^\d+$/.test(searchValue)) {
        query += `&phone=${searchValue}`;
      } else {
        query += `&nickname=${searchValue}`;
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/admin/users${query}`, {
      headers: getAuthHeaders()
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      currentUsersData = data.data.users;
      renderUsersTable(data.data.users);
      updatePagination(
        data.data.pagination,
        'usersPagination',
        'userPageInfo',
        'userPrevPage',
        'userNextPage'
      );
    }
  } catch (err) {
    console.error('加载用户出错:', err);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #999;">暂无用户</td></tr>';
    return;
  }
  
  tbody.innerHTML = users.map(user => {
    const totalSpent = parseFloat(user.total_spent) || 0;
    return `
      <tr>
        <td><strong>#${user.id}</strong></td>
        <td>${user.phone || '-'}</td>
        <td>${user.nickname || '未设置'}</td>
        <td>¥${totalSpent.toFixed(2)}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn" onclick="showUserDetail(${user.id})">详情</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function showUserDetail(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      headers: getAuthHeaders()
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      const user = data.data.user;
      const body = document.getElementById('userDetailBody');
      
      let orderStatsHtml = '';
      if (data.data.order_stats && data.data.order_stats.length > 0) {
        orderStatsHtml = `
          <div>
            <div style="color: #999; font-size: 12px; margin-bottom: 8px; font-weight: 600;">订单统计</div>
            <div style="display: grid; gap: 8px;">
              ${data.data.order_stats.map(stat => {
                const totalSpent = parseFloat(stat.total_spent) || 0;
                return `
                  <div style="display: flex; justify-content: space-between; padding: 8px; background-color: #f9fafb; border-radius: 4px;">
                    <span>${getTypeLabel(stat.type)}</span>
                    <span>订单数: ${stat.count} | 消费: ¥${totalSpent.toFixed(2)}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
      
      let recentOrdersHtml = '';
      if (data.data.recent_orders && data.data.recent_orders.length > 0) {
        const maxDisplay = 5; // 最多显示5条
        const orders = data.data.recent_orders;
        const hasMore = orders.length > maxDisplay;
        const displayOrders = orders.slice(0, maxDisplay);
        
        recentOrdersHtml = `
          <div>
            <div style="color: #999; font-size: 12px; margin-bottom: 8px; font-weight: 600;">
              最近订单 (共${orders.length}条${hasMore ? `，显示前${maxDisplay}条` : ''})
            </div>
            <div style="display: grid; gap: 8px;">
              ${displayOrders.map(order => {
                const price = parseFloat(order.price) || 0;
                return `
                  <div style="display: flex; justify-content: space-between; padding: 8px; background-color: #f9fafb; border-radius: 4px; font-size: 13px;">
                    <span>#${order.id} | ${getTypeLabel(order.type)}</span>
                    <span>¥${price.toFixed(2)} | <span class="status-badge status-${order.status}">${getStatusLabel(order.status)}</span></span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
      
      body.innerHTML = `
        <div style="display: grid; gap: 16px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">用户ID</div>
              <div style="font-weight: 600; font-size: 16px;">#${user.id}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">手机号</div>
              <div style="font-weight: 600;">${user.phone || '-'}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">昵称</div>
              <div style="font-weight: 600;">${user.nickname || '未设置'}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">总消费</div>
              <div style="font-weight: 600; color: #ef4444; font-size: 18px;">¥${(parseFloat(user.total_spent) || 0).toFixed(2)}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">账户余额</div>
              <div style="font-weight: 600; color: #10b981; font-size: 16px;">¥${(parseFloat(user.balance) || 0).toFixed(2)}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">注册时间</div>
              <div>${formatDateTime(user.created_at)}</div>
            </div>
            <div>
              <div style="color: #999; font-size: 12px; margin-bottom: 4px;">最后更新</div>
              <div>${formatDateTime(user.updated_at)}</div>
            </div>
          </div>
          ${orderStatsHtml}
          ${recentOrdersHtml}
        </div>
      `;
      
      document.getElementById('userDetailModal').classList.add('active');
    }
  } catch (err) {
    console.error('加载用户详情出错:', err);
  }
}

function showAdjustBalance(userId) {
  selectedUserId = userId;
  document.getElementById('adjustType').value = 'add';
  document.getElementById('adjustAmount').value = '';
  document.getElementById('adjustRemark').value = '';
  document.getElementById('adjustBalanceModal').classList.add('active');
}

async function submitAdjustBalance() {
  if (!selectedUserId) return;
  
  const type = document.getElementById('adjustType').value;
  const amount = parseFloat(document.getElementById('adjustAmount').value);
  const remark = document.getElementById('adjustRemark').value.trim();
  
  if (!amount || amount <= 0) {
    alert('请输入有效的金额');
    return;
  }
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/users/${selectedUserId}/adjust-balance`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ amount, type, remark })
      }
    );
    
    const data = await response.json();
    
    if (data.code === 0) {
      alert('余额调整成功');
      closeModal('adjustBalanceModal');
      loadUsers();
    } else {
      alert(data.message || '调整失败');
    }
  } catch (err) {
    console.error('调整余额出错:', err);
    alert('网络错误');
  }
}

// ==================== 设置页面 ====================
async function savePrices() {
  const sms = parseFloat(document.getElementById('smsPrice').value);
  const call = parseFloat(document.getElementById('callPrice').value);
  const human = parseFloat(document.getElementById('humanPrice').value);
  
  if (!sms || !call || !human) {
    alert('请输入所有价格');
    return;
  }
  
  alert('价格配置已更新（当前为演示版本，实际需要保存到后端数据库）');
}

async function exportOrderData() {
  const startDate = document.getElementById('exportStartDate').value;
  const endDate = document.getElementById('exportEndDate').value;
  
  if (!startDate || !endDate) {
    alert('请选择日期范围');
    return;
  }
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/export/orders?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: getAuthHeaders()
      }
    );
    
    const data = await response.json();
    
    if (data.code === 0) {
      downloadCSV(data.data, 'orders.csv');
    } else {
      alert(data.message || '导出失败');
    }
  } catch (err) {
    console.error('导出数据出错:', err);
    alert('网络错误');
  }
}

function downloadCSV(data, filename) {
  if (!data || data.length === 0) {
    alert('没有数据可导出');
    return;
  }
  
  // 获取所有列
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // 处理特殊字符
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  // 创建Blob并下载
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// ==================== 工具函数 ====================
function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };
  
  // 添加 CSRF Token（如果存在）
  const csrfToken = apiClient.getCSRFToken();
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  return headers;
}

function getTypeLabel(type) {
  const labels = {
    'sms': '传话短信',
    'call': '和解电话',
    'human': '人工传话'
  };
  return labels[type] || type;
}

function getStatusLabel(status) {
  const labels = {
    'pending': '待处理',
    'processing': '处理中',
    'completed': '已完成',
    'failed': '已失败'
  };
  return labels[status] || status;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
}

function updatePagination(pagination, containerId, infoId, prevBtnId, nextBtnId) {
  const container = document.getElementById(containerId);
  const infoEl = document.getElementById(infoId);
  const prevBtn = document.getElementById(prevBtnId);
  const nextBtn = document.getElementById(nextBtnId);
  
  infoEl.textContent = `第 ${pagination.page} 页，共 ${pagination.totalPages} 页`;
  prevBtn.disabled = pagination.page <= 1;
  nextBtn.disabled = pagination.page >= pagination.totalPages;
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// 将需要在 HTML 中使用的函数暴露到全局作用域
window.showOrderDetail = showOrderDetail;
window.showUserDetail = showUserDetail;
window.updateOrderStatus = updateOrderStatus;
window.closeModal = closeModal;
