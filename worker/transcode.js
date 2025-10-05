import dotenv from 'dotenv'; dotenv.config();
import { Worker } from 'bullmq';
import { randomBytes } from 'crypto';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { Video, VideoVariant, Job } from '../models/index.js';
import { putFile } from '../services/storage.js';

const RAW_DIR = 'storage/raw';
const TMP_DIR = 'tmp/hls';

async function ffmpeg(args=[]) {
  return new Promise((resolve,reject)=>{
    const ff = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, { stdio:['ignore','inherit','inherit'] });
    ff.on('close', code => code===0 ? resolve() : reject(new Error('ffmpeg exit '+code)));
  });
}

// ✅ Nama queue sama dengan queue.js: 'transcode_video'
new Worker('transcode_video', async job => {
  const { videoId } = job.data;
  const rec = await Video.findByPk(videoId);
  if (!rec) return;

  const rawPath = path.join(RAW_DIR, `${videoId}.mp4`);
  const outDirLocal = path.join(TMP_DIR, videoId);
  await fs.promises.mkdir(outDirLocal, { recursive:true });

  await Job.update({ status:'running', progress:10 }, { where:{ video_id:videoId }});

  // Transcode ke HLS
  await ffmpeg([
    '-y','-i', rawPath,
    '-preset','veryfast','-profile:v','main',
    '-vf','scale=-2:720','-c:v','libx264','-c:a','aac','-b:a','128k',
    '-hls_time','6','-hls_playlist_type','vod',
    '-hls_segment_filename', path.join(outDirLocal, '720p_%03d.ts'),
    path.join(outDirLocal, '720p.m3u8')
  ]);

  // Master playlist
  const master = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n720p.m3u8\n';
  await fs.promises.writeFile(path.join(outDirLocal,'master.m3u8'), master);

  // Upload semua file
  const files = await fs.promises.readdir(outDirLocal);
  for (const f of files) {
    await putFile(`${videoId}/${f}`, path.join(outDirLocal, f));
  }

  const baseUrl = (process.env.STORAGE_PROVIDER==='local')
    ? `/storage/hls/${videoId}`
    : `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${videoId}`;

  await VideoVariant.create({ video_id: videoId, label:'720p', bandwidth:2500000, hls_url:`${baseUrl}/720p.m3u8` });

  const key = randomBytes(12).toString('hex');
  await Video.update({
    status:'ready',
    hls_master_url: `/hls/${videoId}/master.m3u8`,
    key_access: key
  }, { where:{ id: videoId }});

  await Job.update({ status:'done', progress:100 }, { where:{ video_id:videoId }});
  try { await fs.promises.rm(outDirLocal, { recursive:true, force:true }); } catch{}
}, { connection: { url: process.env.REDIS_URL }});
