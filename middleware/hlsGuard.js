import { Video } from '../models/Video.js';

function parseTrusted() {
  const s = (process.env.TRUSTED_REFERRERS || '').trim();
  return s ? s.split(',').map(x=>x.trim()) : [];
}

export async function hlsGuard(req, res, next) {
  try {
    const referer = (req.headers.referer || '').toLowerCase();
    const key = (req.query.key || '').trim();
    const videoId = req.params.videoId;

    const video = await Video.findByPk(videoId);
    if (!video || video.status!=='ready') return res.status(404).send('Not found');

    const trusted = parseTrusted();
    const isTrusted = trusted.some(dom => dom && referer.includes(dom.toLowerCase()));
    const isKeyValid = key && key === (video.key_access || '');

    if (isTrusted || isKeyValid) return next();
    return res.status(403).send('Access denied');
  } catch {
    return res.status(403).send('Forbidden');
  }
}
