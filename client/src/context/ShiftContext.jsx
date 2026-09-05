import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const ShiftContext = createContext(null);

export const ShiftProvider = ({ children }) => {
  const { user } = useAuth();
  const [activeShift, setActiveShift] = useState(null);
  const [shiftMetrics, setShiftMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCurrentShift = useCallback(async () => {
    if (!user) {
      setActiveShift(null);
      setShiftMetrics(null);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get('/shifts/current');
      if (res.data.success && res.data.data) {
        setActiveShift(res.data.data.shift || null);
        setShiftMetrics(res.data.data.metrics || null);
      } else {
        setActiveShift(null);
        setShiftMetrics(null);
      }
    } catch (err) {
      console.error('Error fetching current shift:', err);
      setActiveShift(null);
      setShiftMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCurrentShift();
  }, [fetchCurrentShift]);

  const startShift = async ({ shift_name, opening_balance }) => {
    const res = await api.post('/shifts/start', {
      shift_name,
      opening_balance: opening_balance !== undefined ? parseFloat(opening_balance) : 0,
    });
    if (res.data.success) {
      await fetchCurrentShift();
      return res.data.data;
    }
    throw new Error(res.data.error?.message || 'Failed to start shift');
  };

  const endShift = async ({ notes, shift_id } = {}) => {
    const res = await api.post('/shifts/end', { notes, shift_id });
    if (res.data.success) {
      await fetchCurrentShift();
      return res.data.data;
    }
    throw new Error(res.data.error?.message || 'Failed to end shift');
  };

  return (
    <ShiftContext.Provider
      value={{
        activeShift,
        shiftMetrics,
        loading,
        startShift,
        endShift,
        refreshShift: fetchCurrentShift,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
};

export const useShift = () => {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error('useShift must be used within a ShiftProvider');
  }
  return context;
};
