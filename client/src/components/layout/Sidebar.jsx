import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  LayoutGrid,
  Package,
  ShoppingCart,
  ShoppingBag,
  Boxes,
  FileText,
  Users,
  BarChart3,
  Settings,
  ShieldCheck,
  LogOut,
  X,
  TrendingUp,
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const role = user?.role || 'CASHIER';

  const navItems = [
    {
      label: t('nav.dashboard'),
      path: '/',
      icon: LayoutGrid,
      roles: ['ADMIN', 'PHARMACIST', 'CASHIER'],
    },
    {
      label: t('nav.products'),
      path: '/products',
      icon: Package,
      roles: ['ADMIN', 'PHARMACIST', 'CASHIER'],
    },
    {
      label: 'Order History',
      path: '/orders',
      icon: ShoppingBag,
      roles: ['ADMIN', 'PHARMACIST', 'CASHIER'],
    },
    {
      label: t('nav.pos'),
      path: '/pos',
      icon: ShoppingCart,
      roles: ['ADMIN', 'PHARMACIST', 'CASHIER'],
    },
    {
      label: t('nav.inventory'),
      path: '/inventory',
      icon: Boxes,
      roles: ['ADMIN', 'PHARMACIST'],
    },
    {
      label: t('nav.prescriptions'),
      path: '/prescriptions',
      icon: FileText,
      roles: ['ADMIN', 'PHARMACIST'],
    },
    {
      label: t('nav.patients'),
      path: '/patients',
      icon: Users,
      roles: ['ADMIN', 'PHARMACIST'],
    },
    {
      label: t('nav.reports'),
      path: '/reports',
      icon: BarChart3,
      roles: ['ADMIN', 'PHARMACIST'],
    },
    {
      label: t('nav.users'),
      path: '/users',
      icon: ShieldCheck,
      roles: ['ADMIN'],
    },
  ];

  const allowedItems = navItems.filter((item) => item.roles.includes(role));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-100 flex flex-col justify-between p-6 transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-8">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Vibrant Gradient Logo Icon from the reference */}
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#4336D6] via-[#5345E6] to-[#7C3AED] flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Tilex<span className="text-[#5345E6]">.</span>
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 -mt-1">
                  Pharmacy
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {allowedItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-2xl text-sm transition-all duration-150 group ${
                      isActive
                        ? 'bg-[#F0EEFA] text-[#5345E6] font-bold shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 mr-3.5 flex-shrink-0 transition-transform group-hover:scale-105" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions (Settings & Log Out) */}
        <div className="pt-6 border-t border-slate-100 space-y-1.5">
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/settings"
              onClick={() => onClose && onClose()}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded-2xl text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-[#F0EEFA] text-[#5345E6] font-bold'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
                }`
              }
            >
              <Settings className="w-5 h-5 mr-3.5 text-slate-400" />
              <span>{t('nav.settings')}</span>
            </NavLink>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 rounded-2xl text-sm font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 transition-all duration-150 text-left"
          >
            <LogOut className="w-5 h-5 mr-3.5 text-slate-400" />
            <span>{t('auth.logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
