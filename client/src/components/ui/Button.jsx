import React from 'react';

export const Button = ({
  children,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'danger', 'ghost', 'accent'
  size = 'md', // 'sm', 'md', 'lg'
  isLoading = false,
  disabled = false,
  className = '',
  pill = false,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  };

  const roundedClass = pill ? 'rounded-full' : 'rounded-xl';

  const variantStyles = {
    primary:
      'bg-[#5345E6] hover:bg-[#4336D6] text-white focus:ring-[#5345E6] shadow-xs hover:shadow-sm',
    secondary:
      'bg-[#F0EEFA] dark:bg-indigo-950/60 hover:bg-[#E5E1F8] dark:hover:bg-indigo-900/60 text-[#5345E6] dark:text-indigo-400 focus:ring-[#5345E6]',
    outline:
      'border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-[#5345E6]',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500 shadow-xs',
    ghost:
      'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-slate-400',
    accent:
      'bg-[#10B981] hover:bg-[#059669] text-white focus:ring-[#10B981] shadow-xs',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${roundedClass} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
