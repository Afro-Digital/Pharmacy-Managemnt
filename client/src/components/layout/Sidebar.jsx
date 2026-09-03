import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Package,
  FileText,
  Users,
  BarChart3,
  Settings,
  ShieldAlert,
  X,
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const role = user?.role || 'CASHIER';

  const navItems = [
    {
      label: t('nav.dashboard'),
      path: '/',
      icon: LayoutDashboard,
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
      label: t('nav.products'),
      path: '/products',
      icon: Package,
      roles: ['ADMIN', 'PHARMACIST', 'CASHIER'],
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
      icon: ShieldAlert,
      roles: ['ADMIN'],
    },
    {
      label: t('nav.settings'),
      path: '/settings',
      icon: Settings,
      roles: ['ADMIN'],
    },
  ];

  const allowedItems = navItems.filter((item) => item.roles.includes(role));

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
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header on mobile sidebar */}
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950/60 border-b border-slate-800 lg:hidden">
          <span className="font-bold text-white text-lg tracking-wide">TilexPharmacy</span>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {allowedItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => onClose && onClose()}
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800/80 text-xs text-slate-500 text-center">
          TilexPharmacy v1.0 • ETB
        </div>
      </aside>
    </>
  );
};
