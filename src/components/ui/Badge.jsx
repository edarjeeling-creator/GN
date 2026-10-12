import React from 'react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const Badge = ({ className = '', variant = "default", children, ...props }) => {
  const baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2";
  
  const hasCustomBg = className && className.includes('bg-');
  const hasCustomText = className && className.includes('text-');
  const hasCustomBorder = className && className.includes('border-');

  const variants = {
    default: `${hasCustomBorder ? '' : 'border-transparent'} ${hasCustomBg ? '' : 'bg-brand-100 dark:bg-brand-900/50'} ${hasCustomText ? '' : 'text-brand-700 dark:text-brand-300'}`,
    secondary: `${hasCustomBorder ? '' : 'border-transparent'} ${hasCustomBg ? '' : 'bg-slate-100 dark:bg-slate-800'} ${hasCustomText ? '' : 'text-slate-900 dark:text-slate-100'}`,
    outline: `${hasCustomText ? '' : 'text-text-primary'}`,
    success: `${hasCustomBorder ? '' : 'border-emerald-500/30'} ${hasCustomBg ? '' : 'bg-emerald-500/20'} ${hasCustomText ? '' : 'text-emerald-300'}`,
    warning: `${hasCustomBorder ? '' : 'border-amber-500/30'} ${hasCustomBg ? '' : 'bg-amber-500/20'} ${hasCustomText ? '' : 'text-amber-300'}`,
    danger: `${hasCustomBorder ? '' : 'border-red-500/30'} ${hasCustomBg ? '' : 'bg-red-500/20'} ${hasCustomText ? '' : 'text-red-300'}`,
  };

  const variantClass = variants[variant] || variants.default;

  return (
    <div className={cn(baseStyles, variantClass, className)} {...props}>
      {children}
    </div>
  );
};

export { Badge };
