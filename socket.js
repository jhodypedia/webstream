import { Server } from 'socket.io';
let io = null;
export const initIO = (server) => {
  io = new Server(server, { cors:{ origin:'*' } });
};
export const getIO = () => io;
