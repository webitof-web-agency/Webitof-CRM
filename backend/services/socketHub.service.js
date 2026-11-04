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
      socket.emit('notification:connected', { userId });
      joinPermissionRooms(socket, userId);
    }
  });

  return io;
}

function getHub() {
  return io;
}

// Realtime events scoped to a `perm:<room>` room; a socket joins only when it holds every listed permission.
const ROOM_PERMISSIONS = {
  'calls.read': ['calls.read'],
  'calls.recording_view': ['calls.read', 'calls.recording_view']
};

function joinPermissionRooms(socket, userId) {
  // Lazy require avoids a load-time cycle through the service graph.
  const { getUserAccessProfile } = require('./auth.service');
  getUserAccessProfile(userId)
    .then((profile) => {
      if (!profile || !profile.isActive) return;
      const granted = Array.isArray(profile.permissions) ? profile.permissions : [];
      Object.entries(ROOM_PERMISSIONS).forEach(([room, required]) => {
        if (profile.isSuperAdmin || required.every((permission) => granted.includes(permission))) {
          socket.join(`perm:${room}`);
        }
      });
    })
    .catch(() => {});
}

function emitToPermission(permission, eventName, payload, { except } = {}) {
  if (!io || !permission) return;
  const target = io.to(`perm:${permission}`);
  (except ? target.except(`perm:${except}`) : target).emit(eventName, payload);
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
  emitToPermission,
  emitToUser,
  emitToUsers,
  getHub,
  registerSocketHub
};
