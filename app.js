// ================================
// 📁 PansaStream - Main Server
// ================================
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================
// 🚀 INIT EXPRESS + SOCKET.IO
// =====================================
const app = express();
const server = http.createServer(app);
initIO(server);

// =====================================
// ⚙️ MIDDLEWARES
// =====================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(path.join(__dirname, 'storage'))); // ⚠️ dev only

// =====================================
// 🎨 VIEW ENGINE SETUP
// =====================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

// =====================================
// 🧠 SESSION SETUP
// =====================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'pansa-stream-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    sameSite: 'lax'
  }
}));

// =====================================
// 🧩 GLOBAL HELPER MIDDLEWARE
// =====================================
app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.isAdmin = !!req.session.user;

  // default variabel supaya tidak undefined di EJS
  if (typeof res.locals.active === 'undefined') res.locals.active = '';

  // auto switch layout sesuai path
  if (req.originalUrl.startsWith('/admin')) {
    app.set('layout', 'layouts/admin');
  } else {
    app.set('layout', 'layouts/main');
  }

  next();
});

// =====================================
// 🛣️ ROUTES
// =====================================
app.use('/', publicRoutes);
app.use('/api', apiRoutes);
app.use('/hls', hlsRoutes);
app.use('/admin', adminRoutes);

// =====================================
// ❌ ERROR HANDLING
// =====================================

// 404 Not Found
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({ ok: false, error: 'Not Found' });
  } else {
    res.status(404).render('404', {
      title: 'Page Not Found',
      layout: req.originalUrl.startsWith('/admin') ? 'layouts/admin' : 'layouts/main'
    });
  }
});

// 500 Server Error
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  if (req.originalUrl.startsWith('/api/')) {
    res.status(500).json({ ok: false, error: err.message });
  } else {
    res.status(500).render('500', {
      title: 'Server Error',
      error: err.message,
      layout: req.originalUrl.startsWith('/admin') ? 'layouts/admin' : 'layouts/main'
    });
  }
});

// =====================================
// 🚀 START SERVER
// =====================================
const PORT = process.env.PORT || 3000;
await sequelize.sync(); // gunakan migration di production

server.listen(PORT, () => {
  console.log(`🚀 PansaStream running on: http://localhost:${PORT}`);
});
