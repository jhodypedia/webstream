import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { hlsGuard } from '../middleware/hlsGuard.js';

const r = Router();

/**
 * 🔐 HLS Protected Route
 * Contoh:
 *   /hls/12345/master.m3u8
 *   /hls/12345/720p_001.ts
 *   /hls/12345/thumb.jpg
 */
r.get('/:videoId/:filename(*)', hlsGuard, async (req, res) => {
  try {
    const { videoId, filename } = req.params;
    const safeFilename = filename || 'master.m3u8';
    const filePath = path.join('storage/hls', videoId, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Not found');
    }

    // Deteksi MIME agar player tidak error
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // Anti-cache & anti-sniff
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Kirim file
    return res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('[HLS Serve Error]', err);
    return res.status(500).send('Internal Server Error');
  }
});

export default r;
