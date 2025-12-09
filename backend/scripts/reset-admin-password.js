const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function resetAdminPassword() {
  const connection = await pool.getConnection();
  
  try {
    console.log('正在重置管理员密码...');
    
    // 查询管理员账户
    const [users] = await connection.execute(
      'SELECT id, phone, nickname, role FROM users WHERE phone = ?',
      ['15208594927']
    );
    
    if (users.length === 0) {
      console.log('未找到管理员账户，正在创建...');
      
      // 创建管理员账户
      const hashedPassword = await bcrypt.hash('admin123456', 10);
      await connection.execute(
        `INSERT INTO users (openid, phone, password_hash, nickname, avatar, balance, role)
         VALUES ('admin_default', '15208594927', ?, '系统管理员', '👨‍💼', 0, 'admin')`,
        [hashedPassword]
      );
      
      console.log('✓ 管理员账户创建成功');
    } else {
      // 重置密码
      const hashedPassword = await bcrypt.hash('admin123456', 10);
      await connection.execute(
        'UPDATE users SET password_hash = ?, role = ? WHERE phone = ?',
        [hashedPassword, 'admin', '15208594927']
      );
      
      console.log('✓ 管理员密码重置成功');
    }
    
  } catch (error) {
    console.error('重置失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

resetAdminPassword();
