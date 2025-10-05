// 📁 app.js (final fixed)
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

// === Static & Parser ===
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// === EJS Setup ===
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // default layout untuk publik

// === Session ===
app.use(session({
  secret: process.env.SESSION_SECRET || 'pansa-stream-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// === Middleware locals ===
app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.isAdmin = !!req.session.user;
  res.locals.user = req.session.user || null;

  // Gunakan layout admin otomatis jika route diawali /admin
  if (req.originalUrl.startsWith('/admin')) {
    app.set('layout', 'layouts/admin');
  } else {
    app.set('layout', 'layouts/main');
  }

  next();
});

// === Routes ===
app.use('/', publicRoutes);
app.use('/api', apiRoutes);
app.use('/hls', hlsRoutes);
app.use('/admin', adminAuthRoutes);
app.use('/admin', adminRoutes);

// === 404 Handler ===
app.use((req, res) => {
  const layout = req.originalUrl.startsWith('/admin')
    ? 'layouts/admin'
    : 'layouts/main';

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Not Found' });
  }

  res.status(404).render('404', {
    title: 'Not Found',
    layout
  });
});

// === Error Handler ===
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  const layout = req.originalUrl.startsWith('/admin')
    ? 'layouts/admin'
    : 'layouts/main';

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(500).json({ ok: false, error: err.message });
  }

  res.status(500).render('500', {
    title: 'Server Error',
    error: err.message,
    layout
  });
});

// === Auto Port Resolver ===
const PORT = process.env.PORT || 3000;
await sequelize.sync();

const startServer = (port = PORT) => {
  server.listen(port)
    .on('listening', () =>
      console.log(`🚀 Server running on: http://localhost:${port}`)
    )
    .on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${port} in use, trying ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error(err);
      }
    });
};

startServer();
