const mysql = require('mysql2/promise');
require('dotenv').config();

const executeSQL = async () => {
  let connection;
  try {
    // 先连接到MySQL服务器，创建数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('✓ 已连接到MySQL服务器');

    const dbName = process.env.DB_NAME || 'qingyusuchuan';

    // 创建数据库
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('✓ 数据库创建成功');

    // 选择数据库
    await connection.query(`USE \`${dbName}\``);

    // 创建用户表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        openid VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        password_hash VARCHAR(255),
        nickname VARCHAR(255),
        avatar VARCHAR(500),
        balance DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_openid (openid),
        INDEX idx_phone (phone),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ users表创建成功');
    
    // 检查并添加 password_hash 字段（如果不存在）
    try {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_hash'
      `, [dbName]);
      
      if (columns.length === 0) {
        await connection.query(`ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)`);
        console.log('✓ 添加 password_hash 字段成功');
      }
      
      // 修改 openid 允许为 NULL
      await connection.query(`ALTER TABLE users MODIFY COLUMN openid VARCHAR(255) UNIQUE`);
      console.log('✓ users表结构更新成功');
    } catch (alterError) {
      console.log('  users表结构检查:', alterError.message);
    }

    // 创建预设文案表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS presets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        type ENUM('sms') NOT NULL DEFAULT 'sms',
        category VARCHAR(100),
        content LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ presets表创建成功');

    // 创建订单表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type ENUM('sms', 'call', 'human') NOT NULL,
        contact_phone VARCHAR(20),
        contact_method VARCHAR(50),
        content LONGTEXT,
        scheduled_time DATETIME,
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        price DECIMAL(10, 2),
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ orders表创建成功');

    // 创建支付/充值记录表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        amount DECIMAL(10, 2),
        type ENUM('recharge', 'consume') DEFAULT 'recharge',
        order_id INT,
        status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
        remark VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ payments表创建成功');

    // 插入预设文案
    await connection.query(`
      INSERT IGNORE INTO presets (type, category, title, content) VALUES
    `);
    console.log('✓ 预设文案插入成功');

    await connection.end();
    console.log('\n✅ 数据库初始化完成！');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    process.exit(1);
  }
};

executeSQL();
