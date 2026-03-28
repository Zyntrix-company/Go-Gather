import React from 'react';

interface SweeIconProps {
  className?: string;
}

export function SweeIcon({ className = "w-8 h-8" }: SweeIconProps) {
  return (
    <svg 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Main star/sparkle shape */}
      <g>
        {/* Center circle */}
        <circle cx="16" cy="16" r="4" fill="#14B8A6" />
        
        {/* Top ray */}
        <path 
          d="M16 2 L17.5 10 L16 12 L14.5 10 Z" 
          fill="#14B8A6"
        />
        
        {/* Right ray */}
        <path 
          d="M30 16 L22 17.5 L20 16 L22 14.5 Z" 
          fill="#14B8A6"
        />
        
        {/* Bottom ray */}
        <path 
          d="M16 30 L14.5 22 L16 20 L17.5 22 Z" 
          fill="#14B8A6"
        />
        
        {/* Left ray */}
        <path 
          d="M2 16 L10 14.5 L12 16 L10 17.5 Z" 
          fill="#14B8A6"
        />
        
        {/* Top-right diagonal ray */}
        <path 
          d="M24 8 L19 13 L17.5 12.5 L20 10 Z" 
          fill="#2DD4BF"
        />
        
        {/* Bottom-right diagonal ray */}
        <path 
          d="M24 24 L20 22 L17.5 19.5 L19 13 Z" 
          fill="#2DD4BF"
        />
        
        {/* Bottom-left diagonal ray */}
        <path 
          d="M8 24 L10 20 L12.5 17.5 L13 19 Z" 
          fill="#2DD4BF"
        />
        
        {/* Top-left diagonal ray */}
        <path 
          d="M8 8 L13 13 L14.5 12.5 L12 10 Z" 
          fill="#2DD4BF"
        />
      </g>
    </svg>
  );
}
