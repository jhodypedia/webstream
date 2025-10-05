// 📁 app.js
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import expressLayouts from 'express-ejs-layouts';
import http from 'http';
import { initIO } from './socket.js';
import { sequelize } from './models/index.js';

import publicRoutes from './routes/public.js';
import apiRoutes from './routes/api.js';
import hlsRoutes from './routes/hls.js';
import adminRoutes from './routes/admin.js';
import adminAuthRoutes from './routes/adminAuth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
initIO(server);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

app.use(session({
  secret: process.env.SESSION_SECRET || 'pansa-stream-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.isAdmin = !!req.session.user;
  res.locals.user = req.session.user || null;
  next();
});

app.use('/', publicRoutes);
app.use('/api', apiRoutes);
app.use('/hls', hlsRoutes);
app.use('/admin', adminAuthRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => {
  if (req.originalUrl.startsWith('/admin')) {
    res.status(404).render('admin/404', { title: 'Not Found', layout: 'layouts/admin' });
  } else if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({ ok: false, error: 'Not Found' });
  } else {
    res.status(404).render('404', { title: 'Not Found', layout: 'layouts/main' });
  }
});

app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  if (req.originalUrl.startsWith('/admin')) {
    res.status(500).render('admin/500', { title: 'Server Error', error: err.message, layout: 'layouts/admin' });
  } else if (req.originalUrl.startsWith('/api/')) {
    res.status(500).json({ ok: false, error: err.message });
  } else {
    res.status(500).render('500', { title: 'Server Error', error: err.message, layout: 'layouts/main' });
  }
});

const PORT = process.env.PORT || 3000;
await sequelize.sync();
server.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));
