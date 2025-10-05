// /routes/hls.js
import express from 'express';
import path from 'path';
import mime from 'mime-types';
import { fileURLToPath } from 'url';
import { hlsGuard } from '../middleware/hlsGuard.js';

const r = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/**
 * Kita mount middleware pada prefix '/:videoId'
 * Lalu pakai express.static dgn root = storage/hls/:videoId
 * -> Tidak perlu wildcard pattern, jadi bebas dari error path-to-regexp.
 */
r.use('/:videoId', hlsGuard, (req, res, next) => {
  const baseDir = path.join(__dirname, '..', 'storage', 'hls', req.params.videoId);

  // Buat handler static "instance" untuk root yang sesuai videoId
  const serve = express.static(baseDir, {
    fallthrough: false,                    // kalau file nggak ada -> 404
    setHeaders: (res, filePath) => {
      res.setHeader('Content-Type', mime.lookup(filePath) || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  });

  // Jalankan static untuk request ini
  serve(req, res, (err) => {
    if (err) return next(err);
    // Kalau tidak ketemu file
    return res.status(404).send('Not found');
  });
});

export default r;
