import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { hlsGuard } from '../middleware/hlsGuard.js';

const r = Router();

// Layani semua file HLS di folder videoId (master.m3u8, *.m3u8, *.ts, *.mp4 preview)
// GET /hls/:videoId/<anything>
r.get('/:videoId/*', hlsGuard, async (req, res) => {
  const { videoId } = req.params;
  const rest = req.params[0] || 'master.m3u8';
  const filePath = path.join('storage/hls', videoId, rest);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

  // Anti-caching + anti-sniff
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.resolve(filePath));
});

export default r;
