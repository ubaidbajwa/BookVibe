// --- Imports ---

import Redis from 'ioredis';
import dotenv from 'dotenv';

// --- Configuration ---

dotenv.config();

/**
 * UPSTASH SERVERLESS REDIS CONFIGURATION
 * Optimized for serverless environments with ioredis
 */
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn('[Redis] REDIS_URL not set — Redis features (booking lock, cache) are disabled. The DB-level overlap guard remains active.');
}

/**
 * Redis client instance. Null when REDIS_URL is not configured so callers
 * can check `if (!redis)` and degrade gracefully instead of crashing.
 */
const redis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 100, 3000);
      },
      enableReadyCheck: true,
    })
  : null;

// --- Event Listeners ---

if (redis) {
  redis.on('error', (err) => {
    console.error(`[Redis Connection Error] ${err.message}`);
  });
  redis.on('connect', () => {
    console.log('✅ Redis: Connected to Upstash Serverless');
  });
  redis.on('reconnecting', () => {
    console.log('🔄 Redis: Attempting to reconnect...');
  });
}

// --- Exports ---

export default redis;
