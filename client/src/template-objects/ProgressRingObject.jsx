import React, { useRef, useLayoutEffect, useState } from 'react';
import { useTimerState } from '../store/TimerContext';

function timeToSeconds(t) {
  if (!t) return 0;
  const [h, m, s] = t.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function pickColor(leftSeconds, total, props) {
  if (!props.useThresholds) return props.fillColor || '#EF4444';
  if (total <= 0) return props.fillColor || '#22C55E';
  const warn   = props.warningSeconds ?? 30;
  const danger = props.dangerSeconds  ?? 10;
  if (leftSeconds <= danger) return props.dangerColor  || '#EF4444';
  if (leftSeconds <= warn)   return props.warningColor || '#F59E0B';
  return props.fillColor || '#22C55E';
}

export default function ProgressRingObject({ props }) {
  const { selectedDuration, remainingTime } = useTimerState();
  const total = timeToSeconds(selectedDuration);
  const leftRaw = Number(remainingTime) || 0;
  const left = Math.max(0, leftRaw);
  const ratio = total > 0 ? Math.max(0, Math.min(1, 1 - left / total)) : 0;

  // Mesure la taille réelle du wrapper pour que le SVG suive le resize Moveable live
  const wrapRef = useRef();
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const update = () => {
      const r = wrapRef.current.getBoundingClientRect();
      setSize(Math.min(r.width, r.height));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const thickness = props.thickness ?? 20;
  const radius = Math.max(1, (size - thickness) / 2);
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  const fillColor = pickColor(leftRaw, total, props);

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      {size > 0 && (
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
          <circle cx={cx} cy={cy} r={radius} fill="none"
            stroke={props.bgColor || '#374151'} strokeWidth={thickness} />
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={fillColor}
            strokeWidth={thickness}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(${props.startAngle ?? -90} ${cx} ${cy})`}
            style={{ transition: 'stroke 0.3s ease, stroke-dashoffset 1s linear' }}
          />
        </svg>
      )}
    </div>
  );
}
