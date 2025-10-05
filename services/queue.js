import { Queue } from 'bullmq';
import dotenv from 'dotenv'; dotenv.config();

export const transcodeQueue = new Queue('transcode:video', {
  connection: { url: process.env.REDIS_URL }
});
