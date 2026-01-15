/**
 * Redis 客户端配置
 * 用于速率限制、会话存储等
 */

const redis = require('redis');

let redisClient = null;

/**
 * 创建 Redis 客户端
 */
async function createRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  const useRedis = process.env.USE_REDIS === 'true' || process.env.USE_REDIS_RATE_LIMIT === 'true';
  
  if (!useRedis) {
    console.log('ℹ Redis 未启用（通过环境变量 USE_REDIS=true 启用）');
    return null;
  }

  try {
    // 创建 Redis 客户端
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis 重连失败，已达最大重试次数');
            return new Error('Redis 连接失败');
          }
          return Math.min(retries * 100, 3000);
        }
      },
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB || '0')
    });

    // 错误处理
    redisClient.on('error', (err) => {
      console.error('Redis 客户端错误:', err);
    });

    redisClient.on('connect', () => {
      console.log('✓ Redis 连接建立');
    });

    redisClient.on('ready', () => {
      console.log('✓ Redis 客户端就绪');
    });

    redisClient.on('reconnecting', () => {
      console.log('⚠ Redis 正在重新连接...');
    });

    // 连接到 Redis
    await redisClient.connect();
    
    console.log('✓ Redis 连接成功');
    return redisClient;
    
  } catch (error) {
    console.error('Redis 连接失败:', error.message);
    console.log('⚠ 将使用内存存储作为降级方案');
    redisClient = null;
    return null;
  }
}

/**
 * 获取 Redis 客户端实例
 */
function getRedisClient() {
  return redisClient;
}

/**
 * 关闭 Redis 连接
 */
async function closeRedisClient() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✓ Redis 连接已关闭');
    } catch (error) {
      console.error('关闭 Redis 连接失败:', error);
    }
    redisClient = null;
  }
}

/**
 * 检查 Redis 是否可用
 */
async function isRedisAvailable() {
  if (!redisClient) {
    return false;
  }
  
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  createRedisClient,
  getRedisClient,
  closeRedisClient,
  isRedisAvailable
};
