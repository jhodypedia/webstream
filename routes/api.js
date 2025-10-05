import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';
import { Video, Job, VideoVariant } from '../models/index.js';
import { transcodeQueue } from '../services/queue.js';
import { slugify } from '../services/slug.js';

const r = Router();

// Intake dari bot: buat record + trigger transcode
r.post('/videos/intake', async (req,res)=>{
  try {
    const { title, description, owner_user_id } = req.body;
    const id = uuid();
    const slug = (slugify(title) + '-' + id.slice(0,6)).toLowerCase();

    const video = await Video.create({
      id,
      title: title || 'Untitled',
      description: description || '',
      slug,
      status:'uploaded',
      storage_provider: process.env.STORAGE_PROVIDER,
      owner_user_id: owner_user_id || null
    });

    await Job.create({ video_id: id, type:'transcode', status:'queued' });

    // ✅ Kirim ke queue yang baru tanpa titik dua
    await transcodeQueue.add('transcode', { videoId: id });

    res.json({ ok:true, video });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// View ++
r.post('/videos/view/:id', async (req,res)=>{
  const id = req.params.id;
  const v = await Video.findByPk(id);
  if (!v) return res.status(404).json({ok:false});
  await v.increment('views');
  res.json({ok:true});
});

// Public listing
r.get('/public/videos', async (req, res) => {
  const page = Math.max(parseInt(req.query.page||'1'), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit||'24'), 1), 60);
  const offset = (page - 1) * limit;
  const q = (req.query.q || '').trim();

  const where = { status: 'ready' };
  if (q) where.title = { [Op.like]: `%${q}%` };

  const { rows, count } = await Video.findAndCountAll({
    where,
    order: [['createdAt','DESC']],
    limit, offset,
    attributes: ['id','title','slug','views','hls_master_url','createdAt']
  });

  res.json({ ok: true, page, limit, total: count, items: rows });
});

// Rekomendasi
r.get('/public/recommend/:id', async (req, res) => {
  const exclude = req.params.id;
  const limit = 12;
  const items = await Video.findAll({
    where: { status: 'ready', id: { [Op.ne]: exclude } },
    order: [['createdAt','DESC']],
    limit,
    attributes: ['id','title','slug','views','hls_master_url','createdAt']
  });
  res.json({ ok:true, items });
});

export default r;
