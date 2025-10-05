import { Queue } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();

// ✅ Gunakan nama queue tanpa karakter “:”
export const transcodeQueue = new Queue('transcode_video', {
  connection: { url: process.env.REDIS_URL }
});
