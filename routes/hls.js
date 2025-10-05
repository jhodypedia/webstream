import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { hlsGuard } from '../middleware/hlsGuard.js';

const r = Router();

/**
 * ✅ Versi kompatibel dengan Express 5 & path-to-regexp@6
 * Contoh akses:
 *   /hls/abc123/master.m3u8
 *   /hls/abc123/720p_001.ts
 */
r.get('/:videoId/:filename(.*)?', hlsGuard, async (req, res) => {
  try {
    const { videoId, filename } = req.params;
    const targetFile = filename || 'master.m3u8';
    const filePath = path.join('storage/hls', videoId, targetFile);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Not found');
    }

    // set MIME agar player HLS tidak error
    res.setHeader('Content-Type', mime.lookup(filePath) || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('[HLS Serve Error]', err);
    return res.status(500).send('Internal Server Error');
  }
});

export default r;
