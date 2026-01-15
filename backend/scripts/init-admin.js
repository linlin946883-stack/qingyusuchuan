const mysql = require('mysql2/promise');
const bcryptjs = require('bcryptjs');
require('dotenv').config();

/**
 * 初始化管理员账户脚本
 * 使用方法: node scripts/init-admin.js [username] [password]
 * 示例: node scripts/init-admin.js admin 123456789
 */

const args = process.argv.slice(2);
const defaultUsername = 'admin';
const defaultPassword = '123456789';

const username = args[0] || defaultUsername;
const password = args[1] || defaultPassword;

const initAdmin = async () => {
  let connection;
  try {
    console.log('开始初始化管理员账户...\n');

    // 连接到数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'qingyusuchuan'
    });

    console.log('✓ 已连接到数据库');

    // 检查 role 字段是否存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
    `, [process.env.DB_NAME || 'qingyusuchuan']);

    if (columns.length === 0) {
      console.log('未发现role字段，正在添加...');
      await connection.query(`
        ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user' AFTER id
      `);
      console.log('✓ role字段添加成功');
    }

    // 检查 username 字段是否存在
    const [usernameColumns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username'
    `, [process.env.DB_NAME || 'qingyusuchuan']);

    if (usernameColumns.length === 0) {
      console.log('未发现username字段，正在添加...');
      await connection.query(`
        ALTER TABLE users ADD COLUMN username VARCHAR(100) UNIQUE AFTER role
      `);
      console.log('✓ username字段添加成功');
    }

    // 检查是否已存在管理员账户
    const [existingAdmin] = await connection.query(
      `SELECT id FROM users WHERE username = ? AND role = 'admin'`,
      [username]
    );

    if (existingAdmin.length > 0) {
      console.log(`⚠️  管理员账户 "${username}" 已存在\n`);
      console.log('如果需要重置密码，请运行:');
      console.log(`   node scripts/reset-admin-password.js ${username} [newPassword]\n`);
      await connection.end();
      return;
    }

    // 加密密码
    const hashedPassword = await bcryptjs.hash(password, 10);

    // 插入管理员账户
    await connection.query(
      `INSERT INTO users (username, password_hash, role, phone, nickname, balance) 
       VALUES (?, ?, 'admin', '00000000000', '系统管理员', 0)`,
      [username, hashedPassword]
    );

    console.log('✓ 管理员账户创建成功！\n');
    console.log('========================================');
    console.log('📱 管理员账户信息:');
    console.log('========================================');
    console.log(`用户名: ${username}`);
    console.log(`密码:   ${password}`);
    console.log(`角色:   管理员`);
    console.log('========================================\n');
    console.log('⚠️  请妥善保管账号密码！');
    console.log('\n管理后台访问地址:');
    console.log('http://localhost:8000/admin.html\n');

    await connection.end();
    console.log('✅ 初始化完成！');
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('   用户已存在，请使用不同的用户名');
    }
    process.exit(1);
  }
};

initAdmin();
