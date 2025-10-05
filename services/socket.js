// 📁 services/socket.js
import { Server } from 'socket.io';

let ioInstance = null;

/**
 * 🔧 Inisialisasi Socket.IO (dipanggil dari app.js)
 * @param {http.Server} server - instance HTTP server Express
 */
export function initIO(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: '*', // bisa kamu ganti ke domain tertentu di production
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    maxHttpBufferSize: 1e8, // 100MB untuk realtime event besar
  });

  ioInstance.on('connection', socket => {
    console.log('⚡️ Socket connected:', socket.id);

    // Kirim ping awal
    socket.emit('hello', { msg: 'Connected to PansaStream Socket.IO server' });

    // Event contoh
    socket.on('ping', () => {
      socket.emit('pong', { time: Date.now() });
    });

    socket.on('disconnect', reason => {
      console.log(`⚡️ Socket ${socket.id} disconnected (${reason})`);
    });
  });

  console.log('✅ Socket.IO initialized');
  return ioInstance;
}

/**
 * 📡 Ambil instance Socket.IO aktif (untuk digunakan di route atau service lain)
 */
export function getIO() {
  if (!ioInstance) throw new Error('Socket.IO not initialized yet!');
  return ioInstance;
}
