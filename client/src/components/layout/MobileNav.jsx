import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShoppingCart, Boxes, Package } from 'lucide-react';

export const MobileNav = () => {
  const { t } = useTranslation();

  const links = [
    { label: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('nav.pos'), path: '/pos', icon: ShoppingCart },
    { label: t('nav.inventory'), path: '/inventory', icon: Boxes },
    { label: t('nav.products'), path: '/products', icon: Package },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 lg:hidden flex justify-around items-center h-16 px-2 shadow-lg">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="truncate max-w-[65px]">{link.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
