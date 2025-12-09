/**
 * 数据库迁移脚本：为 orders 表添加 idempotency_key 字段
 * 用于实现订单幂等性，防止重复创建订单
 */

const pool = require('../config/database');

async function addIdempotencyKeyColumn() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始添加 idempotency_key 字段...');
    
    // 检查字段是否已存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'idempotency_key'
    `);
    
    if (columns.length > 0) {
      console.log('✓ idempotency_key 字段已存在，跳过创建');
    } else {
      // 添加 idempotency_key 字段
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN idempotency_key VARCHAR(100) NULL COMMENT '幂等性密钥，防止重复提交' 
        AFTER remark
      `);
      console.log('✓ 成功添加 idempotency_key 字段');
      
      // 为该字段创建索引，提高查询性能
      await connection.execute(`
        CREATE INDEX idx_idempotency_key ON orders(user_id, idempotency_key)
      `);
      console.log('✓ 成功创建 idempotency_key 索引');
    }
    
    console.log('迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// 执行迁移
addIdempotencyKeyColumn()
  .then(() => {
    console.log('脚本执行成功');
    process.exit(0);
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
