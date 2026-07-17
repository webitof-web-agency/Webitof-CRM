import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';

const TOKEN_KEY = 'webitof-auth-token';
const USER_KEY = 'webitof-auth-user';

const AuthContext = createContext(null);

function readToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(TOKEN_KEY) || '';
}

function readUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeUser(user) {
  if (typeof window === 'undefined') return;
  if (!user) {
    window.localStorage.removeItem(USER_KEY);
    return;
  }
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore quota / serialization issues.
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readToken());
  const [user, setUser] = useState(() => readUser());
  const [loading, setLoading] = useState(() => Boolean(readToken()) && !Boolean(readUser()));

  useEffect(() => {
    if (!token) {
      setUser(null);
      writeUser(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    const cachedUser = readUser();
    if (cachedUser) {
      setUser(cachedUser);
      setLoading(false);
    } else {
      setLoading(true);
    }
    api.auth.me(token)
      .then((response) => {
        if (!mounted) return;
        setUser(response.data);
        writeUser(response.data);
      })
      .catch(() => {
        if (!mounted) return;
        window.localStorage.removeItem(TOKEN_KEY);
        writeUser(null);
        setToken('');
        setUser(null);
        toast.error('Session expired. Please login again.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const actions = useMemo(() => {
    const hasPermission = (...permissions) => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return permissions.some((permission) => user.permissions?.includes(permission));
    };

    return {
      login: async (identifier, password) => {
        const response = await api.auth.login({ identifier, password });
        const nextToken = response.data.token;
        window.localStorage.setItem(TOKEN_KEY, nextToken);
        writeUser(response.data.user);
        setToken(nextToken);
        setUser(response.data.user);
        toast.success('Welcome back!');
        return response.data.user;
      },
      logout: () => {
        window.localStorage.removeItem(TOKEN_KEY);
        writeUser(null);
        setToken('');
        setUser(null);
        toast.message('Logged out');
      },
      refresh: async () => {
        if (!token) return null;
        const response = await api.auth.me(token);
        setUser(response.data);
        writeUser(response.data);
        return response.data;
      },
      forgotPassword: async (identifier) => api.auth.forgotPassword({ identifier }),
      resetPassword: async (identifier, otp, password, confirmPassword) =>
        api.auth.resetPassword({ identifier, otp, password, confirmPassword }),
      updateProfile: async (payload) => {
        const response = await api.auth.updateProfile(token, payload);
        setUser(response.data);
        writeUser(response.data);
        return response.data;
      },
      deleteAvatar: async () => {
        const response = await api.auth.deleteAvatar(token);
        setUser(response.data);
        writeUser(response.data);
        return response.data;
      },
      hasPermission,
      canManageUsers: () => hasPermission('users.manage'),
      canManageRoles: () => hasPermission('roles.manage'),
      canManagePermissions: () => hasPermission('permissions.manage')
    };
  }, [token, user]);

  const value = useMemo(
    () => ({
      loading,
      token,
      user,
      ...actions
    }),
    [actions, loading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
