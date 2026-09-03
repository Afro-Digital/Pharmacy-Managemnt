import React from 'react';

export const Card = ({
  children,
  className = '',
  hoverable = false,
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-2xl sm:rounded-3xl border border-slate-100/90 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.03)] p-5 sm:p-6 ${
        hoverable ? 'hover:shadow-[0_8px_30px_-5px_rgba(0,0,0,0.06)] hover:border-slate-200 transition-all cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
