const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'qingyusuchuan'
};

async function addSuperAdminField() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功');

    // 检查 is_super_admin 字段是否已存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'is_super_admin'
    `, [dbConfig.database]);

    if (columns.length === 0) {
      // 添加 is_super_admin 字段
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN is_super_admin TINYINT(1) DEFAULT 0 COMMENT '是否超级管理员(1=是, 0=否)'
      `);
      console.log('✓ is_super_admin 字段添加成功');

      // 将第一个管理员设置为超级管理员
      const [result] = await connection.query(`
        UPDATE users 
        SET is_super_admin = 1 
        WHERE role = 'admin' 
        ORDER BY id ASC 
        LIMIT 1
      `);
      
      if (result.affectedRows > 0) {
        console.log('✓ 已将第一个管理员设置为超级管理员');
        
        // 显示超级管理员信息
        const [superAdmin] = await connection.query(`
          SELECT id, phone, nickname, role 
          FROM users 
          WHERE is_super_admin = 1
        `);
        
        if (superAdmin.length > 0) {
          console.log('\n超级管理员信息:');
          console.log(`  ID: ${superAdmin[0].id}`);
          console.log(`  手机号: ${superAdmin[0].phone || '未设置'}`);
          console.log(`  昵称: ${superAdmin[0].nickname || '未设置'}`);
          console.log(`  角色: ${superAdmin[0].role}`);
        }
      } else {
        console.log('⚠ 未找到管理员用户，请手动设置超级管理员');
        console.log('  执行: UPDATE users SET is_super_admin = 1 WHERE id = <你的管理员ID>;');
      }
    } else {
      console.log('✓ is_super_admin 字段已存在，无需添加');
      
      // 检查是否有超级管理员
      const [superAdmins] = await connection.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE is_super_admin = 1
      `);
      
      if (superAdmins[0].count === 0) {
        console.log('⚠ 未找到超级管理员，尝试自动设置...');
        const [result] = await connection.query(`
          UPDATE users 
          SET is_super_admin = 1 
          WHERE role = 'admin' 
          ORDER BY id ASC 
          LIMIT 1
        `);
        
        if (result.affectedRows > 0) {
          console.log('✓ 已将第一个管理员设置为超级管理员');
        }
      }
    }

    console.log('\n✓ 超级管理员字段配置完成');
    console.log('\n注意事项:');
    console.log('  1. 超级管理员权限不可被其他管理员修改');
    console.log('  2. 管理员不能修改自己的权限');
    console.log('  3. 如需更改超级管理员，请直接在数据库中操作');
    
  } catch (error) {
    console.error('✗ 操作失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✓ 数据库连接已关闭');
    }
  }
}

// 运行迁移
addSuperAdminField();
