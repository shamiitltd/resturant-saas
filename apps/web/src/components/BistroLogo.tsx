import React from 'react';

interface BistroLogoProps {
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export function BistroLogo({
  theme = 'light',
  size = 'md',
  showSubtitle = true,
  className = '',
}: BistroLogoProps) {
  const isLight = theme === 'light';

  const iconSizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }[size];

  const titleSizeClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  }[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Orange Circle with Fork & Spoon */}
      <div
        className={`flex ${iconSizeClasses} shrink-0 items-center justify-center rounded-full bg-[#FF4500] shadow-sm`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-5/8 w-5/8 text-white fill-current"
        >
          {/* Fork on Left */}
          <path
            d="M6 3v5c0 1.1.9 2 2 2v10a1 1 0 0 0 2 0V10c1.1 0 2-.9 2-2V3h-1.2v4.5a.3.3 0 0 1-.6 0V3h-1v4.5a.3.3 0 0 1-.6 0V3H6z"
          />
          {/* Spoon on Right */}
          <path
            d="M17 3c-1.66 0-3 1.79-3 4 0 1.63.74 3.01 1.8 3.65V20a1 1 0 0 0 2 0v-9.35C18.86 10.01 20 8.63 20 7c0-2.21-1.34-4-3-4z"
          />
        </svg>
      </div>

      {/* Brand Text */}
      <div>
        <span
          className={`block font-bold tracking-tight ${titleSizeClasses} ${
            isLight ? 'text-white' : 'text-slate-900'
          }`}
        >
          The Bistro OS
        </span>
        {showSubtitle && (
          <span
            className={`block text-[11px] font-medium tracking-tight ${
              isLight ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            Restaurant Management Platform
          </span>
        )}
      </div>
    </div>
  );
}
