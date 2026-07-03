import React from 'react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const Badge = ({ className, variant = "default", children, ...props }) => {
  const baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2";
  
  const variants = {
    default: "border-transparent bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300",
    secondary: "border-transparent bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
    outline: "text-text-primary",
    success: "border-transparent bg-success-100 text-success-700 dark:bg-success-900/50 dark:text-success-300",
    warning: "border-transparent bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-300",
    danger: "border-transparent bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props}>
      {children}
    </div>
  );
};

export { Badge };
