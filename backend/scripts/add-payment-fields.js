/**
 * 数据库迁移脚本 - 添加微信支付相关字段
 * 运行命令: node backend/scripts/add-payment-fields.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'qingyusuchuan'
    });

    console.log('✓ 已连接到数据库');

    // 1. 检查并添加 payments 表的字段
    const [paymentColumns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments'
    `, [process.env.DB_NAME || 'qingyusuchuan']);

    const paymentColumnNames = paymentColumns.map(col => col.COLUMN_NAME);

    // 添加 transaction_id 字段（微信支付订单号）
    if (!paymentColumnNames.includes('transaction_id')) {
      await connection.query(`
        ALTER TABLE payments 
        ADD COLUMN transaction_id VARCHAR(255) UNIQUE COMMENT '微信支付订单号'
      `);
      console.log('✓ payments 表添加 transaction_id 字段');
    }

    // 修改 type 字段，添加 'order' 类型
    await connection.query(`
      ALTER TABLE payments 
      MODIFY COLUMN type ENUM('recharge', 'consume', 'order') DEFAULT 'recharge' 
      COMMENT '支付类型: recharge-充值, consume-消费, order-订单支付'
    `);
    console.log('✓ payments 表更新 type 字段');

    // 修改 status 字段，添加 'closed' 状态
    await connection.query(`
      ALTER TABLE payments 
      MODIFY COLUMN status ENUM('pending', 'completed', 'failed', 'closed') DEFAULT 'pending'
      COMMENT '支付状态: pending-待支付, completed-已完成, failed-失败, closed-已关闭'
    `);
    console.log('✓ payments 表更新 status 字段');

    // 添加 updated_at 字段
    if (!paymentColumnNames.includes('updated_at')) {
      await connection.query(`
        ALTER TABLE payments 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      `);
      console.log('✓ payments 表添加 updated_at 字段');
    }

    // 2. 检查并添加 orders 表的字段
    const [orderColumns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
    `, [process.env.DB_NAME || 'qingyusuchuan']);

    const orderColumnNames = orderColumns.map(col => col.COLUMN_NAME);

    // 修改 status 字段，添加 'paid' 状态
    await connection.query(`
      ALTER TABLE orders 
      MODIFY COLUMN status ENUM('pending', 'paid', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending'
      COMMENT '订单状态: pending-待支付, paid-已支付, processing-处理中, completed-已完成, failed-失败, cancelled-已取消'
    `);
    console.log('✓ orders 表更新 status 字段');

    // 添加 paid_at 字段
    if (!orderColumnNames.includes('paid_at')) {
      await connection.query(`
        ALTER TABLE orders 
        ADD COLUMN paid_at TIMESTAMP NULL COMMENT '支付时间'
      `);
      console.log('✓ orders 表添加 paid_at 字段');
    }

    await connection.end();
    console.log('\n✅ 数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

migrate();
