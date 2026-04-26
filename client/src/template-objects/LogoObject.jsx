import React, { useState, useEffect } from 'react';
import { socket } from '../socket';

// LogoObject — affiche le logo personnalisé du studio (configuré dans Réglages).
// Lit /api/branding/logo. Si aucun logo n'est uploadé (404), bascule sur le
// logo de l'application servi depuis client/public/logo.png — comme ça le
// widget montre toujours quelque chose de signifiant, même sans config.
//
// Cache-busting via socket : quand l'admin upload/supprime un logo dans
// Réglages, le serveur émet `brandingChanged` avec un version timestamp.
// Le param `?v=...` sur le src force le browser à re-fetch (pas de cache stale)
// — indispensable pour /display qui ne se re-monte jamais (kiosk permanent).
export default function LogoObject({ props }) {
  const [version, setVersion] = useState(Date.now());
  const [src, setSrc] = useState(`/api/branding/logo?v=${Date.now()}`);

  useEffect(() => {
    const onBranding = (payload) => {
      const v = (payload && payload.version) || Date.now();
      setVersion(v);
      setSrc(`/api/branding/logo?v=${v}`);
    };
    socket.on('brandingChanged', onBranding);
    return () => socket.off('brandingChanged', onBranding);
  }, []);

  const outerStyle = {
    width: '100%', height: '100%',
    backgroundColor: props.backgroundColor || 'transparent',
    borderRadius: `${props.borderRadius ?? 0}px`,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  return (
    <div style={outerStyle}>
      <img
        key={version}
        src={src}
        alt="Logo"
        onError={() => {
          // 1er fallback : logo de l'app. Si lui aussi échoue, on laisse
          // l'image cassée (rare — le fichier est servi par Vite/Express).
          if (!src.startsWith('/logo.png')) setSrc(`/logo.png?v=${version}`);
        }}
        style={{
          width: '100%', height: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
  );
}
