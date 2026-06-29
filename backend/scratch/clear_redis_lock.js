const { Redis } = require('@upstash/redis');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function run() {
  const phone = '+917063992027';
  const lockoutKey = `otp:lockout:${phone}`;
  const minKey = `otp:limit:min:${phone}`;
  const hourKey = `otp:limit:hour:${phone}`;
  const attemptsKey = `otp:attempts:${phone}`;

  await redis.del(lockoutKey);
  await redis.del(minKey);
  await redis.del(hourKey);
  await redis.del(attemptsKey);

  console.log(`Successfully cleared lockout and rate limits for ${phone} in Redis.`);
}

run().catch(console.error);
