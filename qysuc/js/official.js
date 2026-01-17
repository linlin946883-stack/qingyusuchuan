// 官网平滑滚动
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    
    // 排除导航中的链接处理（已经是hash导航）
    if (href === '#') {
      e.preventDefault();
      return;
    }

    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const offsetTop = target.offsetTop - 70; // 减去导航栏高度
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
  });
});

// 导航栏激活状态
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  
  if (window.scrollY > 50) {
    navbar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.15)';
  } else {
    navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
  }

  // 更新导航菜单的激活状态
  updateActiveNav();
});

function updateActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-menu a');

  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 100;
    if (window.scrollY >= sectionTop) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.style.opacity = '0.6';
    if (link.getAttribute('href') === `#${current}`) {
      link.style.opacity = '1';
    }
  });
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
  // 添加懒加载类名
  const cards = document.querySelectorAll('.feature-card, .scenario-item, .testimonial-card');
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      card.style.transition = 'all 0.6s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, index * 100);
  });

  // 初始化导航状态
  updateActiveNav();
});

// 点击按钮跳转到应用
function goToApp() {
  window.location.href = './index.html';
}

// 点击卡片可以跳转
document.querySelectorAll('.hero-card').forEach(card => {
  card.addEventListener('click', goToApp);
});

// 响应式导航菜单（如果需要）
const menuItems = document.querySelectorAll('.nav-menu a');
menuItems.forEach(item => {
  item.addEventListener('click', () => {
    // 关闭移动菜单（如果有的话）
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu.style.maxHeight) {
      navMenu.style.maxHeight = null;
    }
  });
});

// 页面滚动动画
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
    }
  });
}, observerOptions);

// 观察所有动画元素
document.querySelectorAll('.advantage-item, .step, .scenario-item').forEach(el => {
  observer.observe(el);
});

// 定义 fadeInUp 动画
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);

// 页面性能优化 - 图片懒加载
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          observer.unobserve(img);
        }
      }
    });
  });

  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

// 统计代码或其他第三方集成
console.log('官网已加载完成 - 思语工坊 v1.0');
