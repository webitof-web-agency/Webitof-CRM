import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { API_BASE_URL, api, request } from '../api/client';
import { useAuth } from './AuthContext';
import { notificationTarget } from '../lib/notificationTarget';

const NotificationContext = createContext(null);

const toUnread = (row) => ({
  id: row.id,
  moduleName: row.moduleName || '',
  eventKey: row.eventKey || '',
  entityId: String(row.entityId || ''),
  target: notificationTarget(row)
});

function resolveSocketUrl() {
  if (typeof window === 'undefined') return '';
  const raw = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;
  if (!/^https?:\/\//.test(raw)) return window.location.origin;
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
  // Every unread notification as { id, target } (target = in-app page). The sidebar counts these per
  // menu item, so the list above (only the latest 30) is not enough.
  const [unread, setUnread] = useState([]);
  const unreadRef = useRef(unread);
  unreadRef.current = unread;
  const forget = (ids) => {
    const gone = new Set(ids.map(String));
    setUnread((current) => current.filter((item) => !gone.has(String(item.id))));
  };
  const remember = (notification) =>
    setUnread((current) =>
      current.some((item) => String(item.id) === String(notification.id))
        ? current
        : [toUnread(notification), ...current]
    );
  // Pending work per sidebar path (HRM approvals, alerts, reports...), from GET /hrm/menu-counts.
  // null when the user has no HRM access or the API is older.
  const [menuCounts, setMenuCounts] = useState(null);
  const countsTimer = useRef(null);
  const refreshMenuCounts = useCallback(() => {
    if (!token) return;
    // Bursts (several socket events, a navigation) collapse into one request.
    clearTimeout(countsTimer.current);
    countsTimer.current = setTimeout(() => {
      request('/hrm/menu-counts', { token, skipCache: true })
        .then((response) => setMenuCounts(response.data && typeof response.data === 'object' ? response.data : null))
        .catch(() => setMenuCounts(null));
    }, 400);
  }, [token]);
  useEffect(() => {
    if (!token) {
      setMenuCounts(null);
      return undefined;
    }
    refreshMenuCounts();
    const id = setInterval(() => !document.hidden && refreshMenuCounts(), 60000);
    return () => {
      clearInterval(id);
      clearTimeout(countsTimer.current);
    };
  }, [token, refreshMenuCounts]);
  const loadUnread = useCallback(async () => {
    if (!token) return setUnread([]);
    try {
      const response = await api.notifications.unreadSummary(token);
      setUnread((Array.isArray(response.data) ? response.data : []).map(toUnread));
    } catch {
      // Older API without the summary: the sidebar simply shows no counts.
      setUnread([]);
    }
  }, [token]);

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
    loadUnread();
    return () => {
      mounted = false;
    };
  }, [token, loadUnread]);

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

    socket.on('system:maintenance', (state) => {
      window.dispatchEvent(new CustomEvent('system:maintenance', { detail: state || { active: true } }));
    });

    socket.on('notification:created', (notification) => {
      if (!notification?.id) return;
      setNotifications((current) => mergeNotifications(current, notification));
      setUnreadCount((current) => current + (notification.isRead ? 0 : 1));
      if (!notification.isRead) remember(notification);
      refreshMenuCounts();
      const title = notification.title || 'Notification';
      const target = notificationTarget(notification);
      const options = { description: notification.message || '' };
      // The provider sits outside the router, so open the page through the hash (HashRouter).
      if (target) {
        options.action = {
          label: 'Open',
          onClick: () => {
            forget([notification.id]);
            if (!notification.isRead) api.notifications.markRead(token, notification.id)
              .then((response) => setNotifications((current) => mergeNotifications(current, response.data)))
              .then(() => setUnreadCount((current) => Math.max(0, current - 1)))
              .catch(() => {});
            window.location.hash = target;
          }
        };
      }
      if (notification.severity === 'danger') {
        toast.error(title, options);
      } else if (notification.severity === 'warning') {
        toast.warning(title, options);
      } else if (notification.severity === 'success') {
        toast.success(title, options);
      } else {
        toast.message(title, options);
      }
    });

    socket.on('notification:updated', (notification) => {
      if (!notification?.id) return;
      setNotifications((current) => mergeNotifications(current, notification));
      if (notification.isRead) forget([notification.id]);
    });

    socket.on('notification:read-many', (payload = {}) => {
      refreshMenuCounts();
      const ids = new Set((payload.ids || []).map(String));
      forget([...ids]);
      setNotifications((current) => current.map((item) => (ids.has(String(item.id)) ? { ...item, isRead: true } : item)));
    });

    socket.on('notification:updated-many', () => {
      loadUnread();
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
  }, [token, user, loadUnread, refreshMenuCounts]);

  async function refresh() {
    loadUnread();
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
    forget([id]);
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
    setUnread([]);
    return true;
  }

  // Opening the record a notification is about counts as seeing it: the lead's page, the follow-up
  // the URL focuses, the invoice... Section pages (HRM overview, a module's list) do not, because the
  // item may be one of many there; those clear when the item is opened or acted on (the server
  // closes HRM alerts once a reviewer acts).
  const markSeen = useCallback(
    (pathname, search = '') => {
      if (!token) return;
      const parts = new Set([...pathname.split('/'), ...new URLSearchParams(search).values()].filter(Boolean));
      const seen = unreadRef.current
        .filter((item) => item.entityId && parts.has(item.entityId) && item.target?.split('?')[0] && pathname.startsWith(item.target.split('?')[0]))
        .map((item) => item.id);
      if (!seen.length) return;
      forget(seen);
      api.notifications
        .markManyRead(token, seen)
        .then((response) => {
          if (response.data?.unreadCount != null) setUnreadCount(Number(response.data.unreadCount));
          const ids = new Set(seen.map(String));
          setNotifications((list) => list.map((item) => (ids.has(String(item.id)) ? { ...item, isRead: true } : item)));
        })
        .catch(() => {});
    },
    [token]
  );

  const value = {
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
    markSeen,
    unreadTargets: unread.map((item) => item.target),
    unreadItems: unread,
    menuCounts,
    refreshMenuCounts,
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
