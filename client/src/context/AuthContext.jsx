import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('tilex_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(true);

  const inactivityTimerRef = useRef(null);
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem('tilex_access_token');
      localStorage.removeItem('tilex_refresh_token');
      localStorage.removeItem('tilex_user');
      setUser(null);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    }
  }, []);

  // Reset inactivity timer on user actions
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.warn('Auto-logging out due to 30 minutes of inactivity');
        logout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, logout, INACTIVITY_TIMEOUT]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();

    events.forEach((event) => window.addEventListener(event, handleActivity));
    resetInactivityTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [user, resetInactivityTimer]);

  // Initial user fetch & setup check
  useEffect(() => {
    const initAuth = async () => {
      try {
        const setupRes = await api.get('/auth/setup-status');
        setIsSetup(setupRes.data.data.isSetup);

        const token = localStorage.getItem('tilex_access_token');
        if (token) {
          const res = await api.get('/auth/me');
          setUser(res.data.data);
          localStorage.setItem('tilex_user', JSON.stringify(res.data.data));
        }
      } catch {
        // Token invalid or network issue
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.data.success) {
      const { user: userData, accessToken, refreshToken } = res.data.data;
      localStorage.setItem('tilex_access_token', accessToken);
      localStorage.setItem('tilex_refresh_token', refreshToken);
      localStorage.setItem('tilex_user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    }
    throw new Error(res.data.error?.message || 'Login failed');
  };

  const initialSetup = async (setupData) => {
    const res = await api.post('/auth/setup', setupData);
    if (res.data.success) {
      const { user: userData, accessToken, refreshToken } = res.data.data;
      localStorage.setItem('tilex_access_token', accessToken);
      localStorage.setItem('tilex_refresh_token', refreshToken);
      localStorage.setItem('tilex_user', JSON.stringify(userData));
      setUser(userData);
      setIsSetup(true);
      return userData;
    }
    throw new Error(res.data.error?.message || 'Setup failed');
  };

  return (
    <AuthContext.Provider value={{ user, loading, isSetup, login, logout, initialSetup }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
