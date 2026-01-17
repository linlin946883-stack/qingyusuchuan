// 显示吐司提示
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, duration);
}

// 显示加载提示
function showLoading(message = '加载中...') {
  const loading = document.createElement('div');
  loading.className = 'toast';
  loading.id = 'loading-toast';
  loading.innerHTML = `<div class="loading"></div> ${message}`;
  document.body.appendChild(loading);
}

// 隐藏加载提示
function hideLoading() {
  const loading = document.getElementById('loading-toast');
  if (loading) {
    loading.remove();
  }
}

// 本地存储工具
const storage = {
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  
  get(key) {
    const value = localStorage.getItem(key);
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return value;
    }
  },
  
  remove(key) {
    localStorage.removeItem(key);
  },
  
  clear() {
    localStorage.clear();
  }
};

// 模拟用户数据存储
const mockUsers = [];
let mockOrders = [];
let orderIdCounter = 1;

// 获取当前用户信息
function getUserInfo() {
  const userInfo = storage.get('userInfo');
  if (!userInfo) {
    // 如果没有用户信息，创建一个默认用户
    const defaultUser = {
      user_id: 1,
      openid: 'default_user_' + Date.now(),
      nickname: '游客',
      avatar: '',
      balance: 0
    };
    storage.set('userInfo', defaultUser);
    return defaultUser;
  }
  return userInfo;
}

// 设置用户信息
function setUserInfo(userInfo) {
  storage.set('userInfo', userInfo);
}

// 用户登录（模拟）
async function userLogin(openid, nickname, avatar) {
  return new Promise((resolve) => {
    setTimeout(() => {
      let user = mockUsers.find(u => u.openid === openid);
      if (!user) {
        user = {
          id: mockUsers.length + 1,
          openid,
          nickname,
          avatar,
          balance: 0,
          created_at: new Date().toISOString()
        };
        mockUsers.push(user);
      }
      // 保存用户信息到本地
      const userInfo = {
        user_id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatar: user.avatar,
        balance: user.balance
      };
      setUserInfo(userInfo);
      
      resolve({
        code: 0,
        data: user
      });
    }, 300);
  });
}

// 创建订单（模拟）
async function createOrder(userId, type, subType, content, price) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const order = {
        id: orderIdCounter++,
        user_id: userId,
        type,
        sub_type: subType,
        content,
        price,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      mockOrders.push(order);
      resolve({
        code: 0,
        data: order
      });
    }, 300);
  });
}

// 获取用户订单（模拟）
async function getOrders(userId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const orders = mockOrders.filter(o => o.user_id === userId);
      resolve({
        code: 0,
        data: orders
      });
    }, 300);
  });
}

// 获取预设文案（模拟）
async function getPresets(type = 'call') {
  return new Promise((resolve) => {
    setTimeout(() => {
      const presets = {
        code: 0,
        data: [
          {
            id: 1,
            category: '道歉和解',
            title: '诚恳道歉',
            content: '对不起，之前是我的错，我真诚地向你道歉。希望我们能够重新开始，彼此理解和包容。'
          },
          {
            id: 2,
            category: '道歉和解',
            title: '请求原谅',
            content: '我知道我之前的行为伤害了你，我感到非常抱歉。请给我一个机会改正，让我们的关系回到从前。'
          },
          {
            id: 3,
            category: '情感挽回',
            title: '重燃旧情',
            content: '我一直都没有忘记我们在一起的美好时光。你对我来说很重要，我想重新开始，珍惜我们的感情。'
          },
          {
            id: 4,
            category: '情感挽回',
            title: '表达思念',
            content: '分开的日子里，我每天都在想你。我意识到你是我生命中不可或缺的人，希望能再次拥有你。'
          },
          {
            id: 5,
            category: '解释说明',
            title: '澄清误会',
            content: '我想和你解释一下之前的事情，可能存在一些误会。请给我一个机会说明真相，让我们坦诚相待。'
          },
          {
            id: 6,
            category: '解释说明',
            title: '说明情况',
            content: '关于那件事，我想向你说明实际情况。希望你能听我解释，了解事情的真相，消除彼此的误解。'
          },
          {
            id: 7,
            category: '关心问候',
            title: '表达关心',
            content: '最近过得好吗？虽然我们之间有些不愉快，但我依然关心你。希望你一切都好，有什么需要帮助的随时找我。'
          },
          {
            id: 8,
            category: '关心问候',
            title: '温暖问候',
            content: '好久不见，你最近怎么样？虽然我们有过矛盾，但我还是希望你生活顺利，工作开心。'
          }
        ]
      };
      resolve(presets);
    }, 200);
  });
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

// 截断内容
function truncateContent(content, length = 60) {
  if (!content) return '';
  return content.length > length ? content.substring(0, length) + '...' : content;
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
