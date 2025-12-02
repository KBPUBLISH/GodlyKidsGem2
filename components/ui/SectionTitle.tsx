import React from 'react';

interface SectionTitleProps {
  title: string;
  icon?: string;
  color?: string;
}

const SectionTitle: React.FC<SectionTitleProps> = ({ title, icon }) => {
  // Always use wood-plank brown style for consistency
  const backgroundColor = '#8B4513';
  
  return (
    <div className="relative py-2 my-4 mx-[-10px]">
      {/* Wood Texture Background */}
      <div 
        className="absolute inset-0 rounded-r-xl shadow-lg transform -skew-x-6 origin-bottom-left border-t-2 border-b-4"
        style={{
            backgroundColor: backgroundColor,
            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0,0,0,0.1) 50px, rgba(0,0,0,0.1) 53px), 
                              linear-gradient(to bottom, #8B5A2B, #654321)`,
            borderColor: '#A0522D',
            borderBottomColor: '#5c2e0b'
        }}
      ></div>
      
      {/* Text */}
      <h2 className="relative z-10 text-white font-display text-lg tracking-wide px-6 drop-shadow-md text-shadow flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        {title}
      </h2>
      
      {/* Nail details */}
      <div className="absolute top-1/2 left-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner transform -translate-y-1/2 opacity-80"></div>
      <div className="absolute top-1/2 right-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner transform -translate-y-1/2 opacity-80"></div>
    </div>
  );
};

export default SectionTitle;