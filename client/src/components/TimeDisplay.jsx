import React from 'react';

export default function TimeDisplay({ 
  label, 
  time, 
  variant, 
  warning, 
  size = '100%', 
  elapsedTime, 
  showElapsed = false, 
  color,
  textSize = 'text-[10vw] lg:text-[5vw]',
  labelSize = 'text-[2vw] lg:text-[1vw]'
}) {
  const formatTime = (seconds) => {
    if (typeof seconds !== 'number') return [0, 0, 0];
    
    // Pour le temps restant négatif (dépassement)
    if (seconds < 0) {
      const positiveSeconds = Math.abs(seconds);
      const m = Math.floor(positiveSeconds / 60);
      const s = positiveSeconds % 60;
      return [0, m, s];
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s];
  };

  const [hours, minutes, seconds] = formatTime(time);
  const [elapsedHours, elapsedMinutes, elapsedSeconds] = formatTime(elapsedTime);
  const isOvertime = time < 0;

  // Détermine les classes de couleur en fonction du variant
  const getColorClasses = (isActive) => {
    if (!isActive) return 'bg-gray-700';
    return '';
  };

  const getColorStyle = (isActive) => {
    if (!isActive) return {};
    return { backgroundColor: color };
  };

  // Détermine la couleur du texte
  const getTextColor = () => {
    if (warning || isOvertime) return 'text-red-500';
    return '';
  };

  const getTextColorStyle = () => {
    if (warning || isOvertime) return { color: '#EF4444' };
    return { color };
  };

  // Formate le temps pour l'affichage
  const getDisplayTime = () => {
    if (isOvertime) {
      return `+${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return [hours, minutes, seconds]
      .map(n => String(n).padStart(2, '0'))
      .join(':');
  };

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

  return (
    <div className="p-4">
      <div className="flex flex-col items-center">
        <div className="w-full aspect-square">
          <div className="relative w-full h-full">
            {/* Cercle intérieur - Points des secondes */}
            {[...Array(totalDots)].map((_, index) => {
              const pos = calculatePosition(index, totalDots, innerRadius);
              const isActive = index === 0 || seconds >= index;
              
              return (
                <div
                  key={`second-${index}`}
                  className={`absolute rounded-full transition-colors duration-200 ${getColorClasses(isActive)}`}
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
              
              return (
                <div
                  key={`five-${index}`}
                  className={`absolute rounded-full ${getColorClasses(true)}`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    width: `${dotSize}%`,
                    height: `${dotSize}%`,
                    transform: 'translate(-50%, -50%)',
                    ...getColorStyle(true)
                  }}
                />
              );
            })}

            {/* Affichage numérique au centre */}
            <div className="absolute inset-0 flex flex-col items-center justify-center w-full gap-0">
              <div className={`${labelSize} font-medium tracking-[0.2em] text-gray-400 uppercase -mb-[0.6vw] lg:-mb-[0.3vw]`}>
                {label}
              </div>
              <div 
                className={`${textSize} font-mono font-bold ${getTextColor()}  w-full text-center leading-none tracking-tighter`}
                style={getTextColorStyle()}
              >
                {getDisplayTime()}
              </div>
              {showElapsed && (
                <div className="lg:mt-4 mt-2 lg:px-8 px-3 bg-red-500 rounded-md">
                  <div className="text-[4vw] lg:text-[3.5vw] font-mono font-bold text-white text-center tracking-tight">
                    {[elapsedHours, elapsedMinutes, elapsedSeconds]
                      .map(n => String(n).padStart(2, '0'))
                      .join(':')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 