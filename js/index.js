// 首页初始化
document.addEventListener('DOMContentLoaded', function() {
  
  // 添加卡片点击反馈
  const serviceCards = document.querySelectorAll('.service-card');
  serviceCards.forEach(card => {
    card.addEventListener('touchstart', function() {
      this.style.opacity = '0.8';
    });
    
    card.addEventListener('touchend', function() {
      this.style.opacity = '1';
    });
  });
  
  // 优势卡片点击反馈
  const advantageItems = document.querySelectorAll('.advantage-item');
  advantageItems.forEach(item => {
    item.addEventListener('touchstart', function() {
      this.style.transform = 'translateY(-2px)';
    });
    
    item.addEventListener('touchend', function() {
      this.style.transform = 'translateY(0)';
    });
  });
});