import { Server } from 'socket.io';
import UserAndHost from '../models/UserAndHostModel.js';
import { verifyAccessToken } from '../utils/authTokens.js';

let io = null;

const initSocket = (server) => {
  const socketOrigins = [
    process.env.CLIENT_URL,
    ...(process.env.CLIENT_URLS ?
      process.env.CLIENT_URLS.split(',') :
      []
    ),
    'http://localhost:5173',
    'http://localhost:3000',
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: socketOrigins,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware — verify JWT before allowing connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        // Allow unauthenticated connections (they just won't join rooms)
        socket.userId = null;
        socket.userRole = null;
        return next();
      }

      const decoded = verifyAccessToken(token);
      const user = await UserAndHost.findById(decoded.id || decoded._id)
        .select('_id role isDeleted')
        .lean();

      if (!user || user.isDeleted) {
        socket.userId = null;
        socket.userRole = null;
        return next();
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      next();
    } catch (err) {
      // Don't reject — just mark as unauthenticated
      socket.userId = null;
      socket.userRole = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    const {
      userId,
      userRole
    } = socket;

    if (userId) {
      // Join personal room
      socket.join(`user:${userId}`);

      // Join role-based rooms
      if (userRole === 'host') {
        socket.join(`host:${userId}`);
      }
      if (userRole === 'admin') {
        socket.join('admin');
      }

    }

    // Client can request to join only their own rooms
    socket.on('join:room', (room) => {
      if (!userId || !room || typeof room !== 'string') return;
      const allowed = [`user:${userId}`];
      if (userRole === 'host') allowed.push(`host:${userId}`);
      if (userRole === 'admin') allowed.push('admin');
      if (allowed.includes(room)) socket.join(room);
    });

    // Client can leave rooms
    socket.on('leave:room', (room) => {
      if (userId && room) socket.leave(room);
    });

    // Mark notification as read (broadcast to other tabs)
    socket.on('notification:read', (data) => {
      if (userId && data?.id) {
        socket.to(`user:${userId}`).emit('notification:read', data);
      }
    });

    socket.on('disconnect', () => {});
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket(server) first.');
  return io;
};

export { initSocket, getIO };
