import React from 'react';

interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const NeoButton: React.FC<NeoButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = '',
  ...props 
}) => {
  const baseStyles = "font-bold border-4 border-neo-black shadow-neo transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px] rounded-lg flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-neo-green hover:bg-green-400 text-neo-black",
    secondary: "bg-neo-blue hover:bg-blue-400 text-neo-black",
    accent: "bg-neo-yellow hover:bg-yellow-300 text-neo-black",
    outline: "bg-white hover:bg-gray-50 text-neo-black",
  };

  const sizes = {
    sm: "px-3 py-1 text-sm shadow-neo-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-xl",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};