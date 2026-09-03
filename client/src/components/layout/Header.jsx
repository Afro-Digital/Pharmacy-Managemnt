import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Moon,
  Sun,
  Bell,
  Menu,
  Sparkles,
} from 'lucide-react';

export const Header = ({ onToggleSidebar }) => {
  const { user } = useAuth();
  const { pharmacyDisplayName, currentLang, changeLanguage } = useTheme();
  const { t } = useTranslation();

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
    <header className="flex items-center justify-between px-6 sm:px-8 py-5 bg-white border-b border-slate-100">
      {/* Left Title Area from SellMate */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <span className="text-xs text-slate-400 font-medium tracking-wide">
            Welcome Back!
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {pharmacyDisplayName || 'TilexPharmacy'}
            <span className="text-[#5345E6]">.</span>
          </h1>
        </div>
      </div>

      {/* Right Control Icons and User Profile Pill */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Language Switcher pill */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-full border border-slate-200/50">
          <button
            onClick={() => changeLanguage('en')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
              currentLang === 'en'
                ? 'bg-white text-[#5345E6] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => changeLanguage('am')}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
              currentLang === 'am'
                ? 'bg-white text-[#5345E6] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            አማ
          </button>
        </div>

        {/* Circular Action Buttons matching reference */}
        <button
          type="button"
          title="Theme"
          className="w-10 h-10 rounded-full bg-slate-100/80 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors shadow-2xs"
        >
          <Moon className="w-4 h-4" />
        </button>

        <button
          type="button"
          title="Notifications"
          className="w-10 h-10 rounded-full bg-slate-100/80 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors relative shadow-2xs"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        {/* User Profile Pill */}
        {user && (
          <div className="flex items-center space-x-3 pl-2 sm:pl-3 border-l border-slate-100">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-xs flex-shrink-0">
              {getInitials(user.full_name)}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-sm font-bold text-slate-900 leading-tight">
                {user.full_name}
              </span>
              <span className="text-[11px] font-medium text-slate-400 capitalize">
                {formatRole(user.role)}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
