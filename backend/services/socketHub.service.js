const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

let io = null;

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in environment configuration.');
  }
  return process.env.JWT_SECRET;
}

function parseAuthToken(handshake = {}) {
  const authToken = handshake?.auth?.token || handshake?.query?.token || '';
  const bearerToken = String(authToken || '').replace(/^Bearer\s+/i, '').trim();
  return bearerToken;
}

function registerSocketHub(httpServer, options = {}) {
  io = new Server(httpServer, {
    cors: {
      origin: options.origin || '*',
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const token = parseAuthToken(socket.handshake);
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = jwt.verify(token, getJwtSecret());
      if (payload.purpose || payload.scope) {
        return next(new Error('Authentication required'));
      }
      socket.data.user = {
        id: payload.uid || payload.sub || payload.id || null,
        email: payload.email || '',
        username: payload.username || ''
      };

      if (!socket.data.user.id) {
        return next(new Error('Authentication required'));
      }

      return next();
    } catch (error) {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data?.user?.id;
    if (userId) {
      socket.join(`user:${userId}`);
      socket.join('authenticated');
      socket.emit('notification:connected', { userId });
    }
  });

  return io;
}

function getHub() {
  return io;
}

function broadcastEvent(eventName, payload) {
  if (!io) return;
  io.emit(eventName, payload);
}

function emitToUser(userId, eventName, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(eventName, payload);
}

function emitToUsers(userIds = [], eventName, payload) {
  [...new Set((userIds || []).filter(Boolean).map((value) => String(value)))].forEach((userId) => {
    emitToUser(userId, eventName, payload);
  });
}

module.exports = {
  broadcastEvent,
  emitToUser,
  emitToUsers,
  getHub,
  registerSocketHub
};
