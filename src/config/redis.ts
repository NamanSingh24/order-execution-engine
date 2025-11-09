import Redis from 'ioredis';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Redis connection instance
 */
let redisConnection: Redis | null = null;

/**
 * Redis connection configuration
 */
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false, // Recommended for BullMQ
  retryStrategy: (times: number): number | null => {
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
    return delay;
  },
};

/**
 * Get or create Redis connection instance
 * @returns Redis connection instance
 */
export const getRedisConnection = (): Redis => {
  if (redisConnection) {
    return redisConnection;
  }

  try {
    redisConnection = new Redis(redisConfig);

    // Connection event listeners
    redisConnection.on('connect', () => {
      console.log('Redis: Connection established');
    });

    redisConnection.on('ready', () => {
      console.log('Redis: Ready to accept commands');
    });

    redisConnection.on('error', (error: Error) => {
      console.error('Redis: Connection error:', error.message);
    });

    redisConnection.on('close', () => {
      console.log('Redis: Connection closed');
    });

    redisConnection.on('reconnecting', () => {
      console.log('Redis: Attempting to reconnect...');
    });

    return redisConnection;
  } catch (error) {
    console.error('Redis: Failed to create connection:', error);
    throw new Error(`Failed to connect to Redis: ${error}`);
  }
};

/**
 * Close Redis connection gracefully
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisConnection) {
    try {
      await redisConnection.quit();
      console.log('Redis: Connection closed gracefully');
      redisConnection = null;
    } catch (error) {
      console.error('Redis: Error closing connection:', error);
      // Force disconnect if graceful quit fails
      if (redisConnection) {
        redisConnection.disconnect();
      }
      redisConnection = null;
    }
  }
};

/**
 * Get Redis connection configuration for BullMQ
 * @returns Redis connection configuration object
 */
export const getRedisConfig = () => {
  return {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
};

export default {
  getRedisConnection,
  closeRedisConnection,
  getRedisConfig,
};
