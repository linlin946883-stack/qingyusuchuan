/**
 * 修复脚本：为现有的 orders 表添加 idempotency_key 字段（如果缺失）
 * 用于修复"Unknown column 'idempotency_key'"错误
 */

const pool = require('../config/database');

async function fixMissingIdempotencyKey() {
  const connection = await pool.getConnection();
  
  try {
    console.log('检查 idempotency_key 字段...');
    
    // 检查字段是否存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'idempotency_key'
    `);
    
    if (columns.length > 0) {
      console.log('✓ idempotency_key 字段已存在，无需修复');
      return;
    }
    
    console.log('开始添加缺失的 idempotency_key 字段...');
    
    // 添加字段
    await connection.execute(`
      ALTER TABLE orders 
      ADD COLUMN idempotency_key VARCHAR(100) NULL COMMENT '幂等性密钥，防止重复提交'
    `);
    console.log('✓ 成功添加 idempotency_key 字段');
    
    // 检查索引是否存在
    const [indexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND INDEX_NAME = 'idx_idempotency_key'
    `);
    
    if (indexes.length === 0) {
      // 创建索引
      await connection.execute(`
        CREATE INDEX idx_idempotency_key ON orders(user_id, idempotency_key)
      `);
      console.log('✓ 成功创建 idempotency_key 索引');
    } else {
      console.log('✓ idempotency_key 索引已存在');
    }
    
    console.log('\n✅ 修复完成！');
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// 执行修复
fixMissingIdempotencyKey()
  .then(() => {
    console.log('脚本执行成功');
    process.exit(0);
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
