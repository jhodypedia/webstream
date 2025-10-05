// services/socket.js
import { Server } from 'socket.io';

let io = null;

/** Inisialisasi socket (dipanggil dari app.js) */
export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
  io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);
    socket.on('disconnect', () => console.log('🔴 Socket disconnected:', socket.id));
  });
  return io;
}

/** Ambil instance io di mana pun */
export function getIO() {
  if (!io) throw new Error('Socket.IO belum diinisialisasi');
  return io;
}
