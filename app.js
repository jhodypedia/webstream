import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv'; dotenv.config();
import expressLayouts from 'express-ejs-layouts';
import http from 'http';
import { initIO } from './socket.js';
import { sequelize } from './models/index.js';
import publicRoutes from './routes/public.js';
import apiRoutes from './routes/api.js';
import hlsRoutes from './routes/hls.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
initIO(server);

app.use(express.json({ limit:'50mb' }));
app.use(express.urlencoded({ extended:true, limit:'50mb' }));
app.use('/public', express.static(path.join(__dirname,'public')));
app.use('/storage', express.static(path.join(__dirname,'storage'))); // dev only

app.set('view engine','ejs');
app.set('views', path.join(__dirname,'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(session({ secret:'pansa-stream-secret', resave:false, saveUninitialized:false }));

// Routes
app.use('/', publicRoutes);
app.use('/api', apiRoutes);
app.use('/hls', hlsRoutes); // protected HLS

const PORT = process.env.PORT || 3000;
await sequelize.sync(); // dev; prod pakai migration
server.listen(PORT, ()=> console.log(`Server http://localhost:${PORT}`));
