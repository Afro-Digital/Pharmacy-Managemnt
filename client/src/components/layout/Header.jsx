import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Globe, LogOut, Menu, User, ShieldCheck } from 'lucide-react';

export const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { pharmacyDisplayName, currentLang, changeLanguage } = useTheme();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-slate-200/80 shadow-sm">
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            T
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {pharmacyDisplayName}
            </h1>
            <span className="hidden sm:inline-block text-[11px] font-medium text-slate-400">
              Pharmacy & Cosmetics POS
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Language Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => changeLanguage('en')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              currentLang === 'en'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => changeLanguage('am')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              currentLang === 'am'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            አማርኛ
          </button>
        </div>

        {/* User Info */}
        {user && (
          <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-800">{user.full_name}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200/50">
                {user.role}
              </span>
            </div>
            <button
              onClick={logout}
              title={t('nav.logout')}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
