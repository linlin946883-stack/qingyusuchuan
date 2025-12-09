const mysql = require('mysql2/promise');
require('dotenv').config();

const updateSchema = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'qingyusuchuan'
    });

    console.log('✓ 已连接到数据库');

    // 检查 sort_order 字段是否存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'presets' AND COLUMN_NAME = 'sort_order'
    `);

    if (columns.length === 0) {
      // 添加 sort_order 字段
      await connection.execute(`
        ALTER TABLE presets 
        ADD COLUMN sort_order INT DEFAULT 0 AFTER type,
        ADD INDEX idx_sort (sort_order)
      `);
      console.log('✓ 已添加 sort_order 字段');

      // 修改 type 字段支持 call 和 human
      await connection.execute(`
        ALTER TABLE presets 
        MODIFY COLUMN type ENUM('sms', 'call', 'human') NOT NULL DEFAULT 'sms'
      `);
      console.log('✓ 已更新 type 字段');
    } else {
      console.log('  sort_order 字段已存在，跳过添加');
    }

    // 为现有数据分配排序值
    const [presets] = await connection.execute(`
      SELECT DISTINCT type, category FROM presets ORDER BY type, category
    `);

    let sortOrder = 0;
    for (const preset of presets) {
      await connection.execute(`
        UPDATE presets 
        SET sort_order = ? 
        WHERE type = ? AND category = ?
      `, [sortOrder, preset.type, preset.category]);
      sortOrder++;
    }
    console.log(`✓ 已为 ${sortOrder} 个分类分配排序值`);

    await connection.end();
    console.log('\n✅ 数据库结构更新完成！');
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    process.exit(1);
  }
};

updateSchema();
