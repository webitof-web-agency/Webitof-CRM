import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

function resolveSocketUrl() {
  if (typeof window === 'undefined') return '';
  const raw = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '';
  if (!raw) return window.location.origin;
  const normalized = String(raw).replace(/\/api\/?$/, '');
  return normalized || window.location.origin;
}

function mergeNotifications(current = [], incoming = {}) {
  const list = Array.isArray(current) ? [...current] : [];
  const index = list.findIndex((item) => String(item.id) === String(incoming.id));
  if (index >= 0) {
    list[index] = { ...list[index], ...incoming };
    return list;
  }
  return [incoming, ...list].slice(0, 100);
}

export function NotificationProvider({ children }) {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [socketInstance, setSocketInstance] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [listResponse, countResponse] = await Promise.all([
          api.notifications.list(token, { limit: 30 }),
          api.notifications.unreadCount(token)
        ]);
        if (!mounted) return;
        setNotifications(Array.isArray(listResponse.data) ? listResponse.data : []);
        setUnreadCount(Number(countResponse.data?.unreadCount || 0));
      } catch {
        if (!mounted) return;
        setNotifications([]);
        setUnreadCount(0);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      setSocketInstance(null);
      }
      return;
    }

    const socket = io(resolveSocketUrl(), {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    socket.on('notification:created', (notification) => {
      if (!notification?.id) return;
      setNotifications((current) => mergeNotifications(current, notification));
      setUnreadCount((current) => current + (notification.isRead ? 0 : 1));
      const title = notification.title || 'Notification';
      const message = notification.message || '';
      if (notification.severity === 'danger') {
        toast.error(title, { description: message });
      } else if (notification.severity === 'warning') {
        toast.warning(title, { description: message });
      } else if (notification.severity === 'success') {
        toast.success(title, { description: message });
      } else {
        toast.message(title, { description: message });
      }
    });

    socket.on('notification:updated', (notification) => {
      if (!notification?.id) return;
      setNotifications((current) => mergeNotifications(current, notification));
    });

    socket.on('notification:updated-many', () => {
      api.notifications.unreadCount(token)
        .then((response) => setUnreadCount(Number(response.data?.unreadCount || 0)))
        .catch(() => {});
    });

    socket.on('notification:count', (payload = {}) => {
      setUnreadCount(Number(payload.unreadCount || 0));
    });

    socket.connect();
    socketRef.current = socket;
    setSocketInstance(socket);

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [token, user]);

  async function refresh() {
    if (!token) return;
    const [listResponse, countResponse] = await Promise.all([
      api.notifications.list(token, { limit: 30 }),
      api.notifications.unreadCount(token)
    ]);
    setNotifications(Array.isArray(listResponse.data) ? listResponse.data : []);
    setUnreadCount(Number(countResponse.data?.unreadCount || 0));
  }

  async function markRead(id) {
    if (!token || !id) return null;
    const existing = notifications.find((item) => String(item.id) === String(id));
    const response = await api.notifications.markRead(token, id);
    setNotifications((current) => mergeNotifications(current, response.data));
    if (existing && !existing.isRead) {
      setUnreadCount((current) => Math.max(0, current - 1));
    }
    return response.data;
  }

  async function markAllRead() {
    if (!token) return null;
    await api.notifications.markAllRead(token);
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    return true;
  }

  const value = {
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
    socket: socketInstance
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used inside NotificationProvider');
  }
  return context;
}
