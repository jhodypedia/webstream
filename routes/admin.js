// 📁 routes/admin.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';
import { QueueEvents } from 'bullmq';

import { authAdmin } from '../middleware/authAdmin.js';
import { Video, Job, Setting } from '../models/index.js';
import { slugify } from '../services/slug.js';
import { transcodeQueue } from '../services/queue.js';
import { reloadConfig, runtimeConfig } from '../services/runtime.js';
import { getIO } from '../services/socket.js'; // ✅ ganti dari '../app.js' ke sini

const RAW_DIR = 'storage/raw';
const router = express.Router();

/* ====== PAGES ====== */
router.get('/', authAdmin, async (req, res) => {
  const stats = {
    totalVideos: await Video.count(),
    totalViews: await Video.sum('views') || 0,
    jobsQueued: await Job.count({ where: { status: 'queued' } }),
    jobsRunning: await Job.count({ where: { status: 'running' } }),
  };
  res.render('admin/dashboard', {
    layout: 'layouts/admin',
    active: 'dashboard',
    title: 'Dashboard',
    user: req.session.user,
    stats
  });
});

router.get('/videos', authAdmin, (req, res) => {
  res.render('admin/videos', {
    layout: 'layouts/admin',
    active: 'videos',
    title: 'Video Management',
    user: req.session.user
  });
});

router.get('/upload', authAdmin, (req, res) => {
  res.render('admin/upload', {
    layout: 'layouts/admin',
    active: 'upload',
    title: 'Manual Upload',
    user: req.session.user
  });
});

router.get('/jobs', authAdmin, (req, res) => {
  res.render('admin/jobs', {
    layout: 'layouts/admin',
    active: 'jobs',
    title: 'Transcode Jobs',
    user: req.session.user
  });
});

router.get('/settings', authAdmin, async (req, res) => {
  const rows = await Setting.findAll();
  const env = {};
  rows.forEach(r => env[r.key] = r.value);
  res.render('admin/settings', {
    layout: 'layouts/admin',
    active: 'settings',
    title: 'Server Settings',
    user: req.session.user,
    env
  });
});

/* ====== JSON APIs ====== */

// 🔹 List all videos
router.get('/api/videos', authAdmin, async (req, res) => {
  const items = await Video.findAll({ order: [['createdAt', 'DESC']] });
  res.json({ ok: true, items });
});

// 🔹 Create video manually
router.post('/api/videos', authAdmin, async (req, res) => {
  try {
    const { title, description, hls_master_url, thumbnail_url, status } = req.body;
    if (!title || !hls_master_url)
      return res.status(400).json({ ok: false, msg: 'title & hls_master_url required' });

    const id = uuid();
    const v = await Video.create({
      id,
      title,
      description: description || '',
      slug: `${slugify(title)}-${id.slice(0, 6)}`.toLowerCase(),
      status: status || 'ready',
      hls_master_url,
      thumbnail_url: thumbnail_url || null,
      views: 0
    });

    res.json({ ok: true, item: v });
  } catch (e) {
    console.error('[Create Video Error]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 🔹 Update video
router.put('/api/videos/:id', authAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const v = await Video.findByPk(id);
    if (!v) return res.status(404).json({ ok: false, msg: 'Not found' });

    const { title, description, thumbnail_url, status } = req.body;
    await v.update({
      title: title ?? v.title,
      description: description ?? v.description,
      thumbnail_url: thumbnail_url ?? v.thumbnail_url,
      status: status ?? v.status
    });

    res.json({ ok: true, item: v });
  } catch (e) {
    console.error('[Update Video Error]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 🔹 Delete video
router.delete('/api/videos/:id', authAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Video.destroy({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[Delete Video Error]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ====== Upload manual (Dropzone) ====== */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.promises.mkdir(RAW_DIR, { recursive: true });
    cb(null, RAW_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `tmp_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = /\.(mp4|mov|mkv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only .mp4 .mov .mkv'), ok);
  },
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }
});

router.post('/api/upload', authAdmin, upload.single('file'), async (req, res) => {
  try {
    const originalName = req.file.originalname;
    const id = uuid();
    const slug = `${slugify(originalName.replace(/\.[^/.]+$/, ''))}-${id.slice(0, 6)}`;
    const finalPath = path.join(RAW_DIR, `${id}.mp4`);
    await fs.promises.rename(req.file.path, finalPath);

    const v = await Video.create({
      id,
      title: originalName.replace(/\.[^/.]+$/, ''),
      description: 'Uploaded via Admin',
      slug,
      status: 'uploaded',
      storage_provider: runtimeConfig.STORAGE_PROVIDER,
      owner_user_id: req.session.user.id
    });

    await Job.create({ video_id: id, type: 'transcode', status: 'queued', progress: 0 });
    await transcodeQueue.add('transcode', { videoId: id });

    res.json({ ok: true, id, slug: v.slug, msg: 'Upload received & queued' });
  } catch (e) {
    console.error('[Upload Error]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ====== Jobs list ====== */
router.get('/api/jobs', authAdmin, async (req, res) => {
  try {
    const items = await Job.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
    res.json({ ok: true, items });
  } catch (e) {
    console.error('[Jobs Error]', e);
    res.status(500).json({ ok: false });
  }
});

/* ====== Settings ====== */
router.get('/api/settings', authAdmin, async (req, res) => {
  const rows = await Setting.findAll();
  const map = {};
  rows.forEach(r => (map[r.key] = r.value));
  res.json({ ok: true, items: map });
});

router.post('/api/settings', authAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    for (const k of Object.keys(body)) {
      await Setting.upsert({ key: k, value: body[k] });
    }
    reloadConfig(body);
    res.json({ ok: true });
  } catch (e) {
    console.error('[Save Settings Error]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ====== QueueEvents → Socket.IO realtime ====== */
const queueEvents = new QueueEvents('transcode_video', {
  connection: { url: process.env.REDIS_URL || runtimeConfig.REDIS_URL }
});

queueEvents.on('completed', async ({ jobId }) => {
  try { getIO().emit('job:completed', { jobId }); } 
  catch (err) { console.warn('[Socket not ready]', err.message); }
});
queueEvents.on('failed', async ({ jobId, failedReason }) => {
  try { getIO().emit('job:failed', { jobId, failedReason }); } 
  catch (err) { console.warn('[Socket not ready]', err.message); }
});
queueEvents.on('progress', async ({ jobId, data }) => {
  try { getIO().emit('job:progress', { jobId, data }); } 
  catch (err) { console.warn('[Socket not ready]', err.message); }
});

export default router;
