import React from 'react';

export const Card = ({
  children,
  className = '',
  hoverable = false,
  ...props
}) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100/90 dark:border-slate-800 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.03)] p-5 sm:p-6 text-slate-900 dark:text-slate-100 transition-colors ${
        hoverable ? 'hover:shadow-[0_8px_30px_-5px_rgba(0,0,0,0.06)] hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
