import { Router } from 'express';
import { Video } from '../models/Video.js';
const r = Router();

r.get('/', async (req,res)=> {
  res.render('public/home', { title:'Pansa Streaming' });
});

r.get('/watch/:slug', async (req,res)=>{
  const v = await Video.findOne({ where:{ slug: req.params.slug, status:'ready' }});
  if (!v) return res.status(404).send('Not found');
  res.render('public/watch', { title: v.title, video: v });
});

export default r;
