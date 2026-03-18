import React from 'react';

interface NeoCardProps {
  children: React.ReactNode;
  className?: string;
  color?: 'white' | 'green' | 'blue' | 'yellow' | 'pink';
  hoverEffect?: boolean;
}

const colorMap = {
  white: 'bg-white',
  green: 'bg-neo-green',
  blue: 'bg-neo-blue',
  yellow: 'bg-neo-yellow',
  pink: 'bg-neo-pink',
};

export const NeoCard: React.FC<NeoCardProps> = ({ 
  children, 
  className = '', 
  color = 'white', 
  hoverEffect = true 
}) => {
  const baseClasses = `border-4 border-neo-black shadow-neo rounded-xl p-6 ${colorMap[color]}`;
  const hoverClasses = hoverEffect ? 'transition-all duration-200 hover:-translate-y-1 hover:translate-x-1 hover:shadow-neo-lg' : '';

  return (
    <div className={`${baseClasses} ${hoverClasses} ${className}`}>
      {children}
    </div>
  );
};