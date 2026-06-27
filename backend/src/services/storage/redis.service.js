const { Redis } = require('@upstash/redis');
const logger = require('../../utils/logger');

let redis = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    logger.info("[Redis Service] Upstash Redis client initialized successfully.");
  } catch (err) {
    logger.error("[Redis Service] Failed to initialize Upstash Redis:", err);
  }
} else {
  logger.warn("[Redis Service] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN missing from environment variables.");
}

module.exports = redis;
