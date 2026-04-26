import React from 'react';

export default function ImageObject({ props }) {
  const bg = props.backgroundColor || 'transparent';
  const radius = `${props.borderRadius ?? 0}px`;

  if (!props.filename && !props.assetId) {
    return <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#64748b',
      backgroundColor: bg === 'transparent' ? '#1e293b' : bg,
      borderRadius: radius
    }}>
      (image non chargée)
    </div>;
  }
  const src = `/uploads/${props.filename || props.assetId}`;
  // Le widget garde le ratio natif de l'image (cf. ratioOf + DesignPanel) donc
  // l'image remplit exactement son cadre sans déformation. `contain` reste un
  // garde-fou pour les rares cas où le ratio ne serait pas encore ajusté
  // (chargement initial, image distante).
  return <div style={{
    width: '100%', height: '100%',
    backgroundColor: bg,
    borderRadius: radius,
    overflow: 'hidden'
  }}>
    <img src={src} alt="" style={{
      width: '100%', height: '100%',
      objectFit: 'contain',
      display: 'block'
    }} />
  </div>;
}
