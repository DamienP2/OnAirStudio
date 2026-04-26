import React, { useEffect, useState } from 'react';

export default function FitToViewport({ canvas, children }) {
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handler = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const scale = Math.min(viewport.w / canvas.width, viewport.h / canvas.height);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden'
    }}>
      <div style={{
        width: canvas.width * scale,
        height: canvas.height * scale,
        overflow: 'hidden'
      }}>
        <div style={{
          width: canvas.width,
          height: canvas.height,
          backgroundColor: canvas.backgroundColor || '#000',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
