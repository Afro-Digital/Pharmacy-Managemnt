import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Boxes,
  ShoppingBag,
  FileText,
  CheckCheck,
  X,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

export const NotificationCenter = ({ isOpen, onClose }) => {
  const {
    notifications,
    counts,
    readIds,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearNotification,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState('ALL');
  const popoverRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'ALL') return true;
    return n.category === activeFilter;
  });

  const getCategoryIcon = (type, category) => {
    switch (type) {
      case 'LOW_STOCK':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'EXPIRING_SOON':
        return <AlertOctagon className="w-4 h-4 text-rose-500" />;
      case 'PENDING_ORDER':
        return <ShoppingBag className="w-4 h-4 text-indigo-500" />;
      case 'PENDING_PRESCRIPTION':
        return <FileText className="w-4 h-4 text-sky-500" />;
      default:
        return <Boxes className="w-4 h-4 text-slate-500" />;
    }
  };

  const handleAction = (item) => {
    markAsRead(item.id);
    onClose();
    if (item.link) {
      navigate(item.link);
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 md:w-[420px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden flex flex-col max-h-[540px] animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-[#5345E6]/10 dark:bg-indigo-500/20 text-[#5345E6] dark:text-indigo-400 flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Notifications
            </h3>
            <span className="text-[11px] text-slate-400">
              {notifications.length} total • {notifications.filter((n) => !readIds.includes(n.id)).length} unread
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={fetchNotifications}
            disabled={loading}
            title="Refresh notifications"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#5345E6]' : ''}`} />
          </button>
          {notifications.length > 0 && (
            <button
              onClick={markAllAsRead}
              title="Mark all as read"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-1 px-3.5 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs overflow-x-auto flex-shrink-0">
        {[
          { key: 'ALL', label: 'All', count: notifications.length },
          { key: 'INVENTORY', label: 'Inventory', count: counts.inventory },
          { key: 'ORDERS', label: 'Orders', count: counts.orders },
          { key: 'PRESCRIPTIONS', label: 'Prescriptions', count: counts.prescriptions },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
              activeFilter === tab.key
                ? 'bg-[#5345E6] text-white shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label} {tab.count > 0 && <span className="opacity-80">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {filteredNotifications.length === 0 ? (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
              <CheckCheck className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">All caught up!</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              No active notifications in this category.
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isUnread = !readIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`p-3 sm:p-3.5 transition-colors flex items-start space-x-3 group relative ${
                  isUnread
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {/* Unread indicator dot */}
                {isUnread && (
                  <span className="absolute top-4 left-1.5 w-1.5 h-1.5 rounded-full bg-[#5345E6] ring-2 ring-white dark:ring-slate-900" />
                )}

                {/* Category Icon */}
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getCategoryIcon(item.type, item.category)}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>

                  <div className="flex items-center space-x-2 mt-2">
                    <button
                      onClick={() => handleAction(item)}
                      className="inline-flex items-center text-[10px] font-bold text-[#5345E6] dark:text-indigo-400 hover:underline"
                    >
                      Open Link <ExternalLink className="w-2.5 h-2.5 ml-1" />
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      onClick={() => markAsRead(item.id)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {isUnread ? 'Mark read' : 'Read'}
                    </button>
                  </div>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={() => clearNotification(item.id)}
                  title="Dismiss notification"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-2.5 bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 text-center flex-shrink-0">
          <button
            onClick={markAllAsRead}
            className="text-[11px] font-bold text-[#5345E6] dark:text-indigo-400 hover:underline"
          >
            Mark all notifications as read
          </button>
        </div>
      )}
    </div>
  );
};
