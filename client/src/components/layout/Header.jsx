import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTranslation } from 'react-i18next';
import { NotificationCenter } from './NotificationCenter';
import {
  Moon,
  Sun,
  Bell,
  Menu,
} from 'lucide-react';

export const Header = ({ onToggleSidebar }) => {
  const { user } = useAuth();
  const { pharmacyDisplayName, currentLang, changeLanguage, isDark, toggleThemeMode } = useTheme();
  const { unreadCount } = useNotifications();
  const { t } = useTranslation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Get user avatar initials or default profile avatar
  const getInitials = (name) => {
    if (!name) return 'TP';
    const parts = name.split(' ');
    return parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const formatRole = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'System Owner / Manager';
      case 'PHARMACIST':
        return 'Clinical Pharmacist';
      case 'CASHIER':
        return 'Station Cashier';
      default:
        return role;
    }
  };

  return (
    <header className="flex items-center justify-between px-5 sm:px-7 py-3 sm:py-3.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 transition-colors duration-200">
      {/* Left Title Area */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-wide">
            Welcome Back!
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {pharmacyDisplayName || 'TilexPharmacy'}
            <span className="text-[#5345E6]">.</span>
          </h1>
        </div>
      </div>

      {/* Right Control Icons and User Profile Pill */}
      <div className="flex items-center space-x-2 sm:space-x-3 relative">
        {/* Language Switcher pill */}
        <div className="flex items-center bg-slate-100/90 dark:bg-slate-800 p-1 rounded-full border border-slate-200/50 dark:border-slate-700/60">
          <button
            onClick={() => changeLanguage('en')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
              currentLang === 'en'
                ? 'bg-white dark:bg-slate-700 text-[#5345E6] dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => changeLanguage('am')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
              currentLang === 'am'
                ? 'bg-white dark:bg-slate-700 text-[#5345E6] dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            አማ
          </button>
        </div>

        {/* Dark / Light Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleThemeMode}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="w-10 h-10 rounded-full bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-2xs focus:outline-none"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Notifications Popover Toggle Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            title="Notifications"
            aria-label="Notifications"
            className="w-10 h-10 rounded-full bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors relative shadow-2xs focus:outline-none"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-mono font-bold text-[10px] flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs animate-in zoom-in-50">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Center Popover */}
          <NotificationCenter
            isOpen={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
          />
        </div>

        {/* User Profile Pill */}
        {user && (
          <div className="flex items-center space-x-3 pl-2 sm:pl-3 border-l border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-xs flex-shrink-0">
              {getInitials(user.full_name)}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {user.full_name}
              </span>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400 capitalize">
                {formatRole(user.role)}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
