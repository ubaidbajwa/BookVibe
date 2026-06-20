/**
 * @fileoverview Redis-based distributed lock for property booking synchronization
 * @module utils/bookingLock
 */

import redis from '../config/redis.js';

/* -------------------------------------------------------------------------- */
/*                                Redis Lock                                  */
/* -------------------------------------------------------------------------- */

/**
 * Single-node Redis lock for booking serialisation.
 * If Redis is unavailable, the lock is skipped and the DB-level
 * overlap guard in BookingModel acts as the safety net.
 *
 * @param {string} propertyId - The ID of the property to lock
 * @param {Function} fn - Async function to run while holding the lock
 * @param {number} ttl - Lock timeout in ms (default 10 s)
 * @returns {Promise<any>} The result of the provided function
 * @throws {Error} If the lock cannot be acquired after retries
 */
const withPropertyLock = async (propertyId, fn, ttl = 10000) => {
  // Redis not configured — skip lock and rely solely on the DB-level overlap guard.
  if (!redis) {
    console.warn('[BookingLock] Redis not configured — skipping distributed lock.');
    return await fn();
  }

  const lockKey = `lock:property:${propertyId}`;
  const lockValue = Date.now().toString();

  let lockAcquired = false;

  try {
    // Acquire lock: NX (only if not exists) + PX (expiry)
    const acquired = await redis.set(lockKey, lockValue, 'PX', ttl, 'NX');

    if (!acquired) {
      // Single retry after 500 ms
      await new Promise(r => setTimeout(r, 500));
      const retryAcquired = await redis.set(lockKey, lockValue, 'PX', ttl, 'NX');
      if (!retryAcquired) {
        throw new Error('This property is currently being processed by another request. Please try again in a few seconds.');
      }
    }

    lockAcquired = true;
  } catch (redisErr) {
    // Redis is down / unreachable — degrade gracefully and let the DB
    // overlap guard handle concurrent requests instead of failing 100%.
    if (redisErr.message.includes('being processed')) throw redisErr;
    console.warn('[BookingLock] Redis unavailable, proceeding without lock:', redisErr.message);
  }

  try {
    return await fn();
  } finally {
    if (lockAcquired) {
      try {
        // Release lock atomically — only if we still own it
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await redis.eval(luaScript, 1, lockKey, lockValue);
      } catch (releaseErr) {
        console.warn('[BookingLock] Failed to release lock (will auto-expire):', releaseErr.message);
      }
    }
  }
};

export { withPropertyLock };
