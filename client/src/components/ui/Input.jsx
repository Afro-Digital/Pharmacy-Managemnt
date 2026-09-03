import React, { forwardRef } from 'react';

export const Input = forwardRef(({
  label,
  error,
  helperText,
  className = '',
  id,
  required,
  pill = false,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold text-slate-700 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full px-4 py-2.5 text-sm bg-white border transition-all placeholder:text-slate-400 focus:outline-none focus:ring-3 focus:ring-[#5345E6]/10 focus:border-[#5345E6] ${
          pill ? 'rounded-full' : 'rounded-xl'
        } ${
          error
            ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-500/10'
            : 'border-slate-200 hover:border-slate-300'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
