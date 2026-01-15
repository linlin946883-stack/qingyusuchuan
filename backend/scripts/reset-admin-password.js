const mysql = require('mysql2/promise');
const bcryptjs = require('bcryptjs');
require('dotenv').config();

/**
 * 重置管理员密码脚本
 * 使用方法: node scripts/reset-admin-password.js username newPassword
 * 示例: node scripts/reset-admin-password.js admin newPassword123
 */

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('❌ 参数错误');
  console.log('使用方法: node scripts/reset-admin-password.js username newPassword');
  console.log('示例: node scripts/reset-admin-password.js admin newPassword123\n');
  process.exit(1);
}

const username = args[0];
const newPassword = args[1];

const resetPassword = async () => {
  let connection;
  try {
    console.log('开始重置管理员密码...\n');

    // 连接到数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'qingyusuchuan'
    });

    console.log('✓ 已连接到数据库');

    // 检查管理员是否存在
    const [admin] = await connection.query(
      `SELECT id, username FROM users WHERE username = ? AND role = 'admin'`,
      [username]
    );

    if (admin.length === 0) {
      console.error(`❌ 管理员 "${username}" 不存在\n`);
      await connection.end();
      process.exit(1);
    }

    // 加密新密码
    const hashedPassword = await bcryptjs.hash(newPassword, 10);

    // 更新密码
    await connection.query(
      `UPDATE users SET password_hash = ? WHERE id = ? AND role = 'admin'`,
      [hashedPassword, admin[0].id]
    );

    console.log('✓ 密码重置成功！\n');
    console.log('========================================');
    console.log('📱 管理员账户信息:');
    console.log('========================================');
    console.log(`用户名:   ${username}`);
    console.log(`新密码:   ${newPassword}`);
    console.log('========================================\n');

    await connection.end();
    console.log('✅ 操作完成！');
  } catch (error) {
    console.error('❌ 重置失败:', error.message);
    process.exit(1);
  }
};

resetPassword();
