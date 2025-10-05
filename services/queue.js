import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { runtimeConfig } from '../services/runtime.js';
dotenv.config();

/**
 * Inisialisasi koneksi Redis yang bisa di-reload runtime.
 * Pakai ioredis untuk koneksi yang stabil dan retry otomatis.
 */
let redis = null;
function getRedis() {
  if (!redis) {
    redis = new IORedis(runtimeConfig.REDIS_URL || process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      reconnectOnError: true,
      lazyConnect: false,
    });
    redis.on('error', (err) => console.error('[Redis Error]', err.message));
    redis.on('connect', () => console.log('✅ Redis connected for BullMQ'));
  }
  return redis;
}

/**
 * Queue untuk transcode video HLS
 */
export const transcodeQueue = new Queue('transcode_video', {
  connection: getRedis(),
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
    attempts: 2,
  },
});
