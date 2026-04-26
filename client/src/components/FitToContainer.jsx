import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Variante de FitToViewport qui s'ajuste à la taille du conteneur parent
// (via ResizeObserver) au lieu de la fenêtre. Utilisé pour la preview live
// dans le ControlPanel (cohabite avec un panneau de contrôle à droite).
export default function FitToContainer({ canvas, children }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = size.w && size.h && canvas
    ? Math.min(size.w / canvas.width, size.h / canvas.height)
    : 0;

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', background: '#000'
      }}
    >
      {scale > 0 && (
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
      )}
    </div>
  );
}
