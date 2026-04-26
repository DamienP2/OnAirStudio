import React from 'react';

export default function Clock({ currentTime = '00:00:00', size = '100%', color, isNTPActive = true }) {
  const [hours = 0, minutes = 0, seconds = 0] = (currentTime || '00:00:00')
    .split(':')
    .map(n => parseInt(n, 10));

  const totalDots = 60;
  const fiveMinuteDots = 12;
  
  // Taille unique pour tous les points
  const dotSize = 2.5;  // Points plus gros

  // Rayons ajustés pour un espacement optimal
  const innerRadius = '41%';  // Cercle des secondes
  const outerRadius = '44.5%';  // Cercle des 5 secondes

  const calculatePosition = (index, total, radius) => {
    const angle = (index * 2 * Math.PI) / total - Math.PI / 2;
    const x = 50 + Math.cos(angle) * parseFloat(radius);
    const y = 50 + Math.sin(angle) * parseFloat(radius);
    return { x, y };
  };

  const getColorStyle = (isActive) => {
    if (!isActive) return {};
    return { backgroundColor: color };
  };

  return (
    <div className="relative w-full h-full">
      {/* Cercle intérieur - Points des secondes */}
      {[...Array(totalDots)].map((_, index) => {
        const pos = calculatePosition(index, totalDots, innerRadius);
        const isActive = index === 0 || seconds >= index;
        
        return (
          <div
            key={`second-${index}`}
            className={`absolute rounded-full transition-colors duration-200 ${!isActive ? 'bg-gray-700' : ''}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: `${dotSize}%`,
              height: `${dotSize}%`,
              transform: 'translate(-50%, -50%)',
              ...getColorStyle(isActive)
            }}
          />
        );
      })}

      {/* Cercle extérieur - Points des 5 secondes */}
      {[...Array(fiveMinuteDots)].map((_, index) => {
        const pos = calculatePosition(index, fiveMinuteDots, outerRadius);
        const isActive = true;
        
        return (
          <div
            key={`five-${index}`}
            className={`absolute rounded-full ${!isActive ? 'bg-gray-700' : ''}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: `${dotSize}%`,
              height: `${dotSize}%`,
              transform: 'translate(-50%, -50%)',
              ...getColorStyle(isActive)
            }}
          />
        );
      })}

      {/* Affichage numérique au centre */}
      <div className="absolute inset-0 flex flex-col items-center justify-center w-full gap-3">
        <div className="text-[2vw] lg:text-[1vw] font-medium tracking-[0.2em] text-gray-400 uppercase -mb-3">
          Horloge
          <span className={`ml-2 inline-block w-3 h-3 rounded-full ${isNTPActive ? 'bg-green-500' : 'bg-yellow-500'} translate-y-[-2px]`}></span>
        </div>
        <div 
          className="text-[10vw] lg:text-[5vw] font-mono font-bold w-full text-center leading-none tracking-tighter"
          style={{ color }}
        >
          {[hours, minutes, seconds]
            .map(n => String(n).padStart(2, '0'))
            .join(':')}
        </div>
      </div>
    </div>
  );
} 