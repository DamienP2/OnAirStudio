import React from 'react';

export default function AnalogDisplay({ value, maxValue = 60, size = 'large', color = 'blue', label }) {
  // Nombre total de points LED
  const totalDots = 60;
  
  return (
    <div className="bg-black rounded-lg p-4 border border-gray-800 w-full">
      <div className="flex flex-col items-center">
        {label && (
          <div className="text-sm font-medium text-gray-500 mb-4 tracking-wider">
            {label}
          </div>
        )}
        
        <div className={`relative aspect-square ${
          size === 'large' ? 'w-full max-w-[300px]' : 'w-full max-w-[200px]'
        }`}>
          {/* Cercle de points LED */}
          {[...Array(totalDots)].map((_, index) => {
            const rotation = (index * 360) / totalDots;
            const isActive = value >= index;
            const isFiveMinute = index % 5 === 0;
            
            return (
              <div
                key={index}
                className={`absolute rounded-full transition-colors duration-200
                  ${isFiveMinute ? 'w-4 h-4' : 'w-2 h-2'}
                  ${isActive 
                    ? `bg-${color}-500 ${isFiveMinute ? '' : 'opacity-70'}`
                    : 'bg-gray-800'
                  }
                `}
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `
                    rotate(${rotation}deg) 
                    translateY(-48%) 
                    translateX(-50%)
                  `,
                  transformOrigin: '50% 50%',
                }}
              />
            );
          })}

          {/* Valeur numérique au centre */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`font-mono font-bold text-${color}-500 ${
              size === 'large' ? 'text-5xl' : 'text-3xl'
            }`}>
              
              {String(value).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 