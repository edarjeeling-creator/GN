import React from 'react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const Button = React.forwardRef(({ className, variant = 'primary', size = 'default', isLoading, leftIcon, rightIcon, children, ...props }, ref) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-50 rounded-lg";
  
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
    secondary: "bg-[var(--surface-color)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
    link: "text-brand-600 underline-offset-4 hover:underline",
  };
  
  const sizes = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-9 rounded-md px-3 text-xs",
    lg: "h-11 rounded-md px-8 text-base",
    icon: "h-10 w-10",
  };
  
  const classes = cn(
    baseStyles,
    variants[variant],
    sizes[size],
    className
  );

  return (
    <button
      ref={ref}
      className={classes}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});

Button.displayName = "Button";

export { Button };
