import React from 'react';

interface WoodButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'dark' | 'light';
  fullWidth?: boolean;
}

const WoodButton: React.FC<WoodButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  fullWidth = false,
  ...props 
}) => {
  
  const baseStyles = "relative overflow-hidden font-display font-bold text-white transition-transform active:scale-95 rounded-lg shadow-xl border-b-4";
  
  const variants = {
    primary: "bg-[#8B4513] border-[#5c2e0b] hover:bg-[#A0522D]", // Standard wood
    dark: "bg-[#5c2e0b] border-[#3e1f07] hover:bg-[#70380d]", // Dark wood
    light: "bg-[#CD853F] border-[#8B4513] hover:bg-[#DEB887]"  // Light wood
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className} px-6 py-3`}
      {...props}
    >
      <span className="relative z-10 drop-shadow-md">{children}</span>
      
      {/* Wood grain overlay effect */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 12px)' }}>
      </div>
      
      {/* Highlight for 3D effect */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-20"></div>
    </button>
  );
};

export default WoodButton;