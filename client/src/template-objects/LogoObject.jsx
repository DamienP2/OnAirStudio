import React, { useState } from 'react';

// LogoObject — affiche le logo personnalisé du studio (configuré dans Réglages).
// Lit /api/branding/logo. Si aucun logo n'est uploadé (404), bascule sur le
// logo de l'application servi depuis client/public/logo.png — comme ça le
// widget montre toujours quelque chose de signifiant, même sans config.
export default function LogoObject({ props }) {
  const [src, setSrc] = useState('/api/branding/logo');

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
        src={src}
        alt="Logo"
        onError={() => {
          // 1er fallback : logo de l'app. Si lui aussi échoue, on laisse
          // l'image cassée (rare — le fichier est servi par Vite/Express).
          if (src !== '/logo.png') setSrc('/logo.png');
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
