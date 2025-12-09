/**
 * 数据库唯一约束添加脚本
 * 为关键字段添加唯一索引，防止数据重复
 */

const pool = require('../config/database');

async function addUniqueConstraints() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始添加唯一约束...\n');
    
    // ========== 1. 用户表唯一约束 ==========
    console.log('【1/4】处理 users 表...');
    
    // 检查 phone 字段的唯一索引是否存在
    const [phoneIndexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND INDEX_NAME = 'uk_phone'
    `);
    
    if (phoneIndexes.length === 0) {
      // 先检查是否有重复数据
      const [duplicates] = await connection.execute(`
        SELECT phone, COUNT(*) as count 
        FROM users 
        WHERE phone IS NOT NULL 
        GROUP BY phone 
        HAVING count > 1
      `);
      
      if (duplicates.length > 0) {
        console.log('⚠️  发现重复手机号，需要先清理：');
        duplicates.forEach(row => {
          console.log(`   - 手机号: ${row.phone}, 重复次数: ${row.count}`);
        });
        console.log('   请手动处理重复数据后再运行此脚本');
      } else {
        await connection.execute(`
          ALTER TABLE users 
          ADD UNIQUE INDEX uk_phone (phone)
        `);
        console.log('✓ 成功为 users.phone 添加唯一索引');
      }
    } else {
      console.log('✓ users.phone 唯一索引已存在');
    }
    
    // 检查 openid 字段的唯一索引是否存在（微信登录用）
    const [openidIndexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND INDEX_NAME = 'uk_openid'
    `);
    
    if (openidIndexes.length === 0) {
      const [duplicates] = await connection.execute(`
        SELECT openid, COUNT(*) as count 
        FROM users 
        WHERE openid IS NOT NULL AND openid != ''
        GROUP BY openid 
        HAVING count > 1
      `);
      
      if (duplicates.length > 0) {
        console.log('⚠️  发现重复openid，需要先清理：');
        duplicates.forEach(row => {
          console.log(`   - OpenID: ${row.openid}, 重复次数: ${row.count}`);
        });
      } else {
        await connection.execute(`
          ALTER TABLE users 
          ADD UNIQUE INDEX uk_openid (openid)
        `);
        console.log('✓ 成功为 users.openid 添加唯一索引');
      }
    } else {
      console.log('✓ users.openid 唯一索引已存在');
    }
    
    // ========== 2. 订单表唯一约束 ==========
    console.log('\n【2/4】处理 orders 表...');
    
    // 为 (user_id, idempotency_key) 添加唯一索引
    const [idempotencyIndexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND INDEX_NAME = 'uk_user_idempotency'
    `);
    
    if (idempotencyIndexes.length === 0) {
      // 检查是否有重复的幂等性密钥
      const [duplicates] = await connection.execute(`
        SELECT user_id, idempotency_key, COUNT(*) as count 
        FROM orders 
        WHERE idempotency_key IS NOT NULL 
        GROUP BY user_id, idempotency_key 
        HAVING count > 1
      `);
      
      if (duplicates.length > 0) {
        console.log('⚠️  发现重复的幂等性密钥：');
        for (const row of duplicates) {
          console.log(`   - 用户ID: ${row.user_id}, 密钥: ${row.idempotency_key}, 重复次数: ${row.count}`);
          
          // 自动清理：只保留第一条，删除其他重复订单
          const [orders] = await connection.execute(`
            SELECT id FROM orders 
            WHERE user_id = ? AND idempotency_key = ? 
            ORDER BY id ASC
          `, [row.user_id, row.idempotency_key]);
          
          if (orders.length > 1) {
            const idsToDelete = orders.slice(1).map(o => o.id);
            await connection.execute(`
              DELETE FROM orders WHERE id IN (${idsToDelete.join(',')})
            `);
            console.log(`   ✓ 已删除重复订单: ${idsToDelete.join(', ')}`);
          }
        }
      }
      
      await connection.execute(`
        ALTER TABLE orders 
        ADD UNIQUE INDEX uk_user_idempotency (user_id, idempotency_key)
      `);
      console.log('✓ 成功为 orders(user_id, idempotency_key) 添加唯一索引');
    } else {
      console.log('✓ orders(user_id, idempotency_key) 唯一索引已存在');
    }
    
    // ========== 3. 管理员表唯一约束 ==========
    console.log('\n【3/4】处理 admins 表（如果存在）...');
    
    // 检查表是否存在
    const [adminTables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'admins'
    `);
    
    if (adminTables.length > 0) {
      // 检查 username 唯一索引
      const [adminUsernameIndexes] = await connection.execute(`
        SELECT INDEX_NAME 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'admins' 
          AND INDEX_NAME = 'uk_admin_username'
      `);
      
      if (adminUsernameIndexes.length === 0) {
        const [duplicates] = await connection.execute(`
          SELECT username, COUNT(*) as count 
          FROM admins 
          WHERE username IS NOT NULL 
          GROUP BY username 
          HAVING count > 1
        `);
        
        if (duplicates.length > 0) {
          console.log('⚠️  发现重复管理员用户名：');
          duplicates.forEach(row => {
            console.log(`   - 用户名: ${row.username}, 重复次数: ${row.count}`);
          });
        } else {
          await connection.execute(`
            ALTER TABLE admins 
            ADD UNIQUE INDEX uk_admin_username (username)
          `);
          console.log('✓ 成功为 admins.username 添加唯一索引');
        }
      } else {
        console.log('✓ admins.username 唯一索引已存在');
      }
    } else {
      console.log('⊙ admins 表不存在，跳过');
    }
    
    // ========== 4. 敏感词表唯一约束 ==========
    console.log('\n【4/4】处理 sensitive_words 表（如果存在）...');
    
    const [sensitiveWordTables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'sensitive_words'
    `);
    
    if (sensitiveWordTables.length > 0) {
      const [wordIndexes] = await connection.execute(`
        SELECT INDEX_NAME 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'sensitive_words' 
          AND INDEX_NAME = 'uk_word'
      `);
      
      if (wordIndexes.length === 0) {
        const [duplicates] = await connection.execute(`
          SELECT word, COUNT(*) as count 
          FROM sensitive_words 
          WHERE word IS NOT NULL 
          GROUP BY word 
          HAVING count > 1
        `);
        
        if (duplicates.length > 0) {
          console.log('⚠️  发现重复敏感词：');
          for (const row of duplicates) {
            console.log(`   - 敏感词: ${row.word}, 重复次数: ${row.count}`);
            
            // 自动清理：只保留第一条
            const [words] = await connection.execute(`
              SELECT id FROM sensitive_words 
              WHERE word = ? 
              ORDER BY id ASC
            `, [row.word]);
            
            if (words.length > 1) {
              const idsToDelete = words.slice(1).map(w => w.id);
              await connection.execute(`
                DELETE FROM sensitive_words WHERE id IN (${idsToDelete.join(',')})
              `);
              console.log(`   ✓ 已删除重复敏感词记录: ${idsToDelete.join(', ')}`);
            }
          }
        }
        
        await connection.execute(`
          ALTER TABLE sensitive_words 
          ADD UNIQUE INDEX uk_word (word)
        `);
        console.log('✓ 成功为 sensitive_words.word 添加唯一索引');
      } else {
        console.log('✓ sensitive_words.word 唯一索引已存在');
      }
    } else {
      console.log('⊙ sensitive_words 表不存在，跳过');
    }
    
    // ========== 5. 显示所有唯一约束 ==========
    console.log('\n\n========== 当前数据库唯一约束总览 ==========\n');
    
    const [allUniqueIndexes] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND NON_UNIQUE = 0
        AND INDEX_NAME != 'PRIMARY'
      GROUP BY TABLE_NAME, INDEX_NAME
      ORDER BY TABLE_NAME, INDEX_NAME
    `);
    
    if (allUniqueIndexes.length > 0) {
      allUniqueIndexes.forEach(idx => {
        console.log(`✓ ${idx.TABLE_NAME}.${idx.INDEX_NAME}: (${idx.COLUMNS})`);
      });
    } else {
      console.log('⊙ 没有发现唯一索引（除主键外）');
    }
    
    console.log('\n========================================');
    console.log('✅ 唯一约束添加完成！');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// 执行脚本
addUniqueConstraints()
  .then(() => {
    console.log('脚本执行成功');
    process.exit(0);
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
