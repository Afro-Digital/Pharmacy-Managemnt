import React from 'react';

export const Badge = ({
  children,
  variant = 'neutral', // 'success', 'warning', 'danger', 'info', 'primary', 'neutral', 'stock'
  size = 'sm',
  className = '',
}) => {
  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-600 font-semibold',
    warning: 'bg-amber-50 text-amber-600 font-semibold',
    danger: 'bg-rose-50 text-rose-600 font-semibold',
    info: 'bg-blue-50 text-blue-600 font-semibold',
    primary: 'bg-[#F0EEFA] text-[#5345E6] font-semibold',
    neutral: 'bg-slate-100 text-slate-600 font-medium',
  };

  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-3 py-1 text-xs',
    md: 'px-3.5 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full transition-colors ${sizeStyles[size]} ${variantStyles[variant] || variantStyles.neutral} ${className}`}
    >
      {children}
    </span>
  );
};
