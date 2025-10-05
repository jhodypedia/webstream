import dotenv from 'dotenv'; dotenv.config();
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { randomBytes } from 'crypto';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { Video, VideoVariant, Job } from '../models/index.js';
import { putFile } from '../services/storage.js';
import { runtimeConfig } from '../services/runtime.js';

const RAW_DIR = 'storage/raw';
const TMP_DIR = 'tmp/hls';
const THUMB_DIR = 'storage/thumbs';

/** 
 * Helper: jalankan ffmpeg 
 */
async function ffmpeg(args = []) {
  return new Promise((resolve, reject) => {
    const ff = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    ff.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code)));
  });
}

/**
 * Buat koneksi Redis runtime-aware
 */
const redis = new IORedis(runtimeConfig.REDIS_URL || process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  reconnectOnError: true,
});
redis.on('error', err => console.error('[Redis Error]', err.message));
redis.on('connect', () => console.log('✅ Worker Redis connected'));

/**
 * Fungsi generate master playlist
 */
function makeMasterPlaylist(variants) {
  let m3u = '#EXTM3U\n#EXT-X-VERSION:3\n';
  for (const v of variants) {
    m3u += `#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidth},RESOLUTION=${v.resolution}\n${v.filename}\n`;
  }
  return m3u;
}

/**
 * Worker utama
 */
new Worker('transcode_video', async job => {
  const { videoId } = job.data;
  console.log(`🎬 Starting transcode job for ${videoId}`);
  const rec = await Video.findByPk(videoId);
  if (!rec) return console.warn(`⚠️ Video ${videoId} not found`);

  const rawPath = path.join(RAW_DIR, `${videoId}.mp4`);
  const outDir = path.join(TMP_DIR, videoId);
  await fs.promises.mkdir(outDir, { recursive: true });

  await Job.update({ status: 'running', progress: 10 }, { where: { video_id: videoId } });

  // === 1️⃣ Buat beberapa resolusi
  const variants = [
    { label: '480p', scale: '854:480', bandwidth: 800000 },
    { label: '720p', scale: '1280:720', bandwidth: 2500000 },
  ];

  for (const v of variants) {
    const seg = path.join(outDir, `${v.label}_%03d.ts`);
    const playlist = path.join(outDir, `${v.label}.m3u8`);
    console.log(`→ Transcoding ${v.label}`);

    await ffmpeg([
      '-y', '-i', rawPath,
      '-preset', 'veryfast', '-profile:v', 'main',
      '-vf', `scale=${v.scale}`,
      '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '128k',
      '-hls_time', '6', '-hls_playlist_type', 'vod',
      '-hls_segment_filename', seg,
      playlist
    ]);
    v.filename = `${v.label}.m3u8`;
    v.resolution = v.scale.split(':')[1] === '720' ? '1280x720' : '854x480';
  }

  // === 2️⃣ Master playlist
  const master = makeMasterPlaylist(variants);
  await fs.promises.writeFile(path.join(outDir, 'master.m3u8'), master);

  // === 3️⃣ Buat thumbnail
  const thumbPath = path.join(THUMB_DIR, `${videoId}.jpg`);
  await fs.promises.mkdir(THUMB_DIR, { recursive: true });
  try {
    await ffmpeg(['-ss', '00:00:02', '-i', rawPath, '-frames:v', '1', '-q:v', '3', thumbPath]);
  } catch (e) {
    console.warn('⚠️ Thumbnail generation failed:', e.message);
  }

  // === 4️⃣ Upload ke storage
  const files = await fs.promises.readdir(outDir);
  for (const f of files) {
    await putFile(`${videoId}/${f}`, path.join(outDir, f));
  }

  if (fs.existsSync(thumbPath)) await putFile(`thumbs/${videoId}.jpg`, thumbPath);

  // === 5️⃣ Simpan ke DB
  const baseUrl = (runtimeConfig.STORAGE_PROVIDER || process.env.STORAGE_PROVIDER) === 'local'
    ? `/storage/hls/${videoId}`
    : `${runtimeConfig.S3_ENDPOINT || process.env.S3_ENDPOINT}/${runtimeConfig.S3_BUCKET || process.env.S3_BUCKET}/${videoId}`;

  for (const v of variants) {
    await VideoVariant.create({
      video_id: videoId,
      label: v.label,
      bandwidth: v.bandwidth,
      hls_url: `${baseUrl}/${v.filename}`
    });
  }

  const key = randomBytes(12).toString('hex');
  await Video.update({
    status: 'ready',
    hls_master_url: `/hls/${videoId}/master.m3u8`,
    thumbnail_url: `/storage/thumbs/${videoId}.jpg`,
    key_access: key
  }, { where: { id: videoId } });

  await Job.update({ status: 'done', progress: 100 }, { where: { video_id: videoId } });
  console.log(`✅ Transcode complete for ${videoId}`);

  // === 6️⃣ Bersihkan tmp
  try { await fs.promises.rm(outDir, { recursive: true, force: true }); } catch {}
}, { connection: redis });
