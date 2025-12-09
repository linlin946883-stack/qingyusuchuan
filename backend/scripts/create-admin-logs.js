const pool = require('../config/database');

async function createAdminLogsTable() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始创建管理员访问日志表...');
    
    // 创建 admin_logs 表
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS admin_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          user_phone VARCHAR(20),
          user_nickname VARCHAR(255),
          endpoint VARCHAR(500),
          method VARCHAR(10),
          status_code INT,
          ip_address VARCHAR(50),
          user_agent TEXT,
          request_body JSON,
          response_code INT,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_created_at (created_at),
          INDEX idx_endpoint (endpoint),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✓ admin_logs 表创建成功');
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('○ admin_logs 表已存在');
      } else {
        throw err;
      }
    }
    
    console.log('✓ 所有迁移完成');
    process.exit(0);
  } catch (error) {
    console.error('创建表失败:', error.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

createAdminLogsTable();
