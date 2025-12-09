const pool = require('../config/database');

async function addAdminFields() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始添加管理员相关字段...');
    
    // 1. 给 users 表添加 role 字段
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user' AFTER balance
      `);
      console.log('✓ users 表添加 role 字段成功');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('○ role 字段已存在，跳过');
      } else {
        throw err;
      }
    }
    
    // 2. 给 orders 表添加 virtual_number 字段（用于存储分配的虚拟号码）
    try {
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN virtual_number VARCHAR(20) DEFAULT NULL AFTER contact_method
      `);
      console.log('✓ orders 表添加 virtual_number 字段成功');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('○ virtual_number 字段已存在，跳过');
      } else {
        throw err;
      }
    }
    
    // 3. 设置一个默认管理员账户（如果不存在）
    const [existingAdmin] = await connection.execute(
      "SELECT id FROM users WHERE phone = '15208594927'"
    );
    
    if (existingAdmin.length === 0) {
      // 创建默认管理员
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123456', 10);
      
      await connection.execute(`
        INSERT INTO users (openid, phone, password_hash, nickname, avatar, balance, role)
        VALUES ('admin_default', '15208594927', ?, '系统管理员', '👨‍💼', 0, 'admin')
      `, [hashedPassword]);
    } else {
      // 确保现有账户是管理员
      await connection.execute(
        "UPDATE users SET role = 'admin' WHERE phone = '15208594927'"
      );
      console.log('✓ 已确认管理员账户');
    }
    
    console.log('\n所有管理员字段添加完成！');
    
  } catch (error) {
    console.error('添加字段失败:', error);
    throw error;
  } finally {
    connection.release();
    pool.end();
  }
}

addAdminFields();
