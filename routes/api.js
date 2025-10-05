import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';
import { Video, Job, VideoVariant } from '../models/index.js';
import { transcodeQueue } from '../services/queue.js';
import { slugify } from '../services/slug.js';

const r = Router();

/**
 * 📦 Upload Intake dari Telegram Bot
 * Menerima data video (title, desc, user), lalu kirim ke BullMQ Worker
 */
r.post('/videos/intake', async (req, res) => {
  try {
    const { title, description, owner_user_id } = req.body;
    const id = uuid();

    // pastikan slug unik
    const baseSlug = slugify(title || 'video');
    const slug = `${baseSlug}-${id.slice(0, 6)}`.toLowerCase();

    // simpan ke DB
    const video = await Video.create({
      id,
      title: title || 'Untitled',
      description: description || '',
      slug,
      status: 'uploaded',
      storage_provider: process.env.STORAGE_PROVIDER || 'local',
      owner_user_id: owner_user_id || null
    });

    // catat job
    await Job.create({
      video_id: id,
      type: 'transcode',
      status: 'queued',
      progress: 0
    });

    // kirim ke BullMQ
    try {
      await transcodeQueue.add('transcode', { videoId: id });
    } catch (err) {
      console.error('[Queue Error]', err.message);
    }

    res.json({ ok: true, video });
  } catch (e) {
    console.error('[Intake Error]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * 👁️ Tambah views saat video diputar
 */
r.post('/videos/view/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Video.findByPk(id);
    if (!video) return res.status(404).json({ ok: false, msg: 'Video not found' });

    await video.increment('views');
    res.json({ ok: true });
  } catch (e) {
    console.error('[View Error]', e);
    res.status(500).json({ ok: false });
  }
});

/**
 * 🧾 Daftar video publik (infinite scroll)
 */
r.get('/public/videos', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1'), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '24'), 1), 60);
    const offset = (page - 1) * limit;
    const q = (req.query.q || '').trim();

    const where = { status: 'ready' };
    if (q) where.title = { [Op.like]: `%${q}%` };

    const { rows, count } = await Video.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      attributes: ['id', 'title', 'slug', 'views', 'hls_master_url', 'createdAt']
    });

    res.json({ ok: true, page, limit, total: count, items: rows });
  } catch (e) {
    console.error('[Public Videos Error]', e);
    res.status(500).json({ ok: false });
  }
});

/**
 * 🎞️ Rekomendasi video (sidebar)
 */
r.get('/public/recommend/:id', async (req, res) => {
  try {
    const exclude = req.params.id;
    const limit = 12;

    const items = await Video.findAll({
      where: { status: 'ready', id: { [Op.ne]: exclude } },
      order: [['createdAt', 'DESC']],
      limit,
      attributes: ['id', 'title', 'slug', 'views', 'hls_master_url', 'createdAt']
    });

    res.json({ ok: true, items });
  } catch (e) {
    console.error('[Recommend Error]', e);
    res.status(500).json({ ok: false });
  }
});

export default r;
