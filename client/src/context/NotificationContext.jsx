import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ total: 0, inventory: 0, orders: 0, prescriptions: 0 });
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('tilex_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      if (res.data.success && res.data.data) {
        setNotifications(res.data.data.notifications || []);
        setCounts(res.data.data.counts || { total: 0, inventory: 0, orders: 0, prescriptions: 0 });
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    // Poll for notifications every 45 seconds while user is logged in
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = (id) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      localStorage.setItem('tilex_read_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const combined = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(combined);
    localStorage.setItem('tilex_read_notifications', JSON.stringify(combined));
  };

  const clearNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    markAsRead(id);
  };

  const unreadNotifications = notifications.filter((n) => !readIds.includes(n.id));
  const unreadCount = unreadNotifications.length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadNotifications,
        counts,
        unreadCount,
        readIds,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        clearNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
