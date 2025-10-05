import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { hlsGuard } from '../middleware/hlsGuard.js';

const r = Router();

/**
 * 🔐 Aman untuk semua versi Express
 * Menangani semua path setelah /:videoId/
 * contoh: /hls/abc123/master.m3u8  → videoId=abc123
 *         /hls/abc123/720p_001.ts → filename=720p_001.ts
 */
r.get('/:videoId/*', hlsGuard, async (req, res) => {
  try {
    const videoId = req.params.videoId;
    // ambil path sisa setelah /:videoId/
    const filename = req.params[0] || 'master.m3u8';
    const filePath = path.join('storage/hls', videoId, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Not found');
    }

    // Deteksi MIME
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('[HLS Serve Error]', err);
    return res.status(500).send('Internal Server Error');
  }
});

export default r;
