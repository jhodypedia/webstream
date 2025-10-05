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

const app = express();
const server = http.createServer(app);
initIO(server);

// =====================================
// ⚙️ MIDDLEWARE
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
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 hari
}));

// =====================================
// 🧩 GLOBAL VARIABLES UNTUK SEMUA LAYOUT
// =====================================
app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.isAdmin = !!req.session.user;
  res.locals.user = req.session.user || null; // ✅ agar <%= user %> tidak undefined
  res.locals.active = ''; // default value agar tidak undefined

  // Auto pilih layout sesuai route
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
app.use((req, res) => {
  const isAdmin = req.originalUrl.startsWith('/admin');
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({ ok: false, error: 'Not Found' });
  } else {
    res.status(404).render('404', { 
      title: 'Not Found', 
      layout: isAdmin ? 'layouts/admin' : 'layouts/main'
    });
  }
});

app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  const isAdmin = req.originalUrl.startsWith('/admin');
  if (req.originalUrl.startsWith('/api/')) {
    res.status(500).json({ ok: false, error: err.message });
  } else {
    res.status(500).render('500', { 
      title: 'Server Error',
      error: err.message,
      layout: isAdmin ? 'layouts/admin' : 'layouts/main'
    });
  }
});

// =====================================
// 🚀 START SERVER
// =====================================
const PORT = process.env.PORT || 3000;
await sequelize.sync();

server.listen(PORT, () => {
  console.log(`🚀 PansaStream running on: http://localhost:${PORT}`);
});
