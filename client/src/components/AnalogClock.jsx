import React from 'react';

export default function AnalogClock({
  currentTime,
  color = '#FFFFFF',
  isNTPActive,
  label = 'Horloge',
  showNTPDot = true,
  showLabel = true,
  showSeconds = true,
  showMinutes = true,
  size = '100%',
  textSize = 'text-[16cqw]',
  labelSize = 'text-[3.7cqw]'
}) {
  // Filtre les segments HH:MM:SS du texte central selon les toggles.
  // Les couronnes de points (secondes/5-min) sont toujours visibles —
  // les toggles ne touchent que les chiffres centraux.
  function filterDigits(raw) {
    if (!raw) return '';
    const parts = raw.split(':');
    const hh = parts[0], mm = parts[1], ss = parts[2];
    const out = [];
    if (hh != null) out.push(hh);
    if (mm != null && showMinutes !== false) out.push(mm);
    if (ss != null && showSeconds !== false) out.push(ss);
    return out.join(':');
  }
  const displayedTime = filterDigits(currentTime);
  // Paramètres des cercles de points
  const totalDots = 60;
  const fiveMinuteDots = 12;
  const dotSize = 2.5;
  const innerRadius = '44%';
  const outerRadius = '48%';

  // Calculer la position des points
  const calculatePosition = (index, total, radius) => {
    const angle = (index * 2 * Math.PI) / total - Math.PI / 2;
    const x = 50 + Math.cos(angle) * parseFloat(radius);
    const y = 50 + Math.sin(angle) * parseFloat(radius);
    return { x, y };
  };

  // Obtenir les secondes actuelles
  const getCurrentSeconds = () => {
    const [hours, minutes, seconds] = currentTime.split(':').map(Number);
    return seconds;
  };

  const seconds = getCurrentSeconds();

  return (
    <div className="relative w-full h-full" style={{ containerType: 'size' }}>
      {/* Cercle intérieur - Points des secondes (60 dots) — toujours visibles */}
      {[...Array(totalDots)].map((_, index) => {
        const pos = calculatePosition(index, totalDots, innerRadius);
        const isActive = index === 0 || seconds >= index;
        return (
          <div
            key={`second-${index}`}
            className={`absolute rounded-full transition-colors duration-200 ${isActive ? '' : 'bg-gray-700'}`}
            style={{
              left: `${pos.x}%`, top: `${pos.y}%`,
              width: `${dotSize}%`, height: `${dotSize}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: isActive ? color : undefined
            }}
          />
        );
      })}

      {/* Cercle extérieur - Points des 5 minutes (12 dots) — toujours visibles */}
      {[...Array(fiveMinuteDots)].map((_, index) => {
        const pos = calculatePosition(index, fiveMinuteDots, outerRadius);
        return (
          <div
            key={`five-${index}`}
            className="absolute rounded-full"
            style={{
              left: `${pos.x}%`, top: `${pos.y}%`,
              width: `${dotSize}%`, height: `${dotSize}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: color
            }}
          />
        );
      })}

      {/* Affichage numérique au centre — padding % pour éviter de toucher les points */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ padding: '4%' }}>
        {showLabel && (
          <div className={`${labelSize} font-medium tracking-[0.2em] text-gray-400 uppercase`}>
            {label}
            {showNTPDot && (
              <span className={`ml-2 inline-block w-[0.5em] h-[0.5em] rounded-full ${isNTPActive ? 'bg-green-500' : 'bg-yellow-500'} align-middle`}></span>
            )}
          </div>
        )}
        <div
          className={`${textSize} font-mono font-bold text-center leading-none tracking-tight whitespace-nowrap`}
          style={{ color }}
        >
          {displayedTime}
        </div>
      </div>
    </div>
  );
}
