import React, { useEffect, useRef } from 'react';

// Widget Vidéo — quatre cas selon mode + source :
//   recorded + upload   → <video src="/uploads/...">
//   recorded + youtube  → <iframe Player YouTube>
//   live     + ndi      → placeholder "NDI Tools requis" (backend stub)
//   live     + sdi      → placeholder "En cours de développement"
//
// Comportement display : autoplay forcé muté (browser policy), loop par défaut.

function parseYoutubeId(url) {
  if (!url) return null;
  // Formats supportés : youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, live URLs
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.replace(/^\//, '').split('/')[0];
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'embed' || parts[0] === 'live') return parts[1] || null;
    return null;
  } catch { return null; }
}

function buildYoutubeEmbed(id, { autoplay, loop, muted, controls }) {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute:     muted ? '1' : '0',
    loop:     loop ? '1' : '0',
    controls: controls ? '1' : '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1'
  });
  // Loop YouTube nécessite playlist=ID pour fonctionner sur une seule vidéo
  if (loop) params.set('playlist', id);
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export default function VideoObject({ width, height, props }) {
  const {
    mode = 'recorded',
    recordedSource = 'upload',
    filename, youtubeUrl,
    liveSource = 'ndi',
    ndiSourceName, sdiDeviceId,
    autoplay = true, loop = true, muted = true, controls = false,
    startTime = 0,
    objectFit = 'cover',
    backgroundColor = '#000000',
    borderRadius = 0
  } = props || {};

  const videoRef = useRef(null);

  // Replay au chargement / changement source : applique le startTime
  useEffect(() => {
    const v = videoRef.current;
    if (v && startTime > 0) {
      try { v.currentTime = startTime; } catch {}
    }
  }, [filename, startTime]);

  const outerStyle = {
    width: '100%', height: '100%',
    background: backgroundColor,
    borderRadius: `${borderRadius}px`,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  };

  // ── Mode : flux LIVE ─────────────────────────────────────────────────
  if (mode === 'live') {
    if (liveSource === 'ndi') {
      if (!ndiSourceName) {
        return <Placeholder style={outerStyle} icon="📡" title="NDI"
          message="Choisis une source NDI dans l'inspector." />;
      }
      return <NdiLiveStream
        sourceName={ndiSourceName}
        quality={props.quality || 'standard'}
        objectFit={objectFit}
        outerStyle={outerStyle}
      />;
    }
    if (liveSource === 'sdi') {
      return <Placeholder style={outerStyle} icon="🎬" title="SDI / Decklink"
        message={sdiDeviceId ? `Device : ${sdiDeviceId}` : 'Aucune carte sélectionnée'} badge="en cours de dev" />;
    }
    return <Placeholder style={outerStyle} icon="🎬" title="Source live" message="Configuration incomplète." />;
  }

  // ── Mode : vidéo ENREGISTRÉE ─────────────────────────────────────────
  if (recordedSource === 'youtube') {
    const id = parseYoutubeId(youtubeUrl);
    if (!id) {
      return <Placeholder style={outerStyle} icon="▶️" title="YouTube"
        message={youtubeUrl ? 'URL invalide. Colle un lien YouTube valide.' : 'Colle une URL YouTube dans l\'inspector.'} />;
    }
    return (
      <div style={outerStyle}>
        <iframe
          src={buildYoutubeEmbed(id, { autoplay, loop, muted, controls })}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title="YouTube video"
        />
      </div>
    );
  }

  // recordedSource === 'upload'
  if (!filename) {
    return <Placeholder style={outerStyle} icon="🎞️" title="Vidéo"
      message="Choisis ou upload une vidéo dans l'inspector." />;
  }
  return (
    <div style={outerStyle}>
      <video
        ref={videoRef}
        src={`/uploads/${filename}`}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        controls={controls}
        playsInline
        style={{ width: '100%', height: '100%', objectFit }}
      />
    </div>
  );
}

// ── NDI live stream avec gestion d'état (connecting / live / error) ────────
// Le browser décode le flux multipart MJPEG nativement via <img>. On utilise
// les events `onLoad` (1ère frame reçue) et `onError` (connexion perdue) pour
// piloter l'affichage. En cas d'erreur, on tente de se reconnecter toutes les 3s.
function NdiLiveStream({ sourceName, quality, objectFit, outerStyle }) {
  const [state, setState] = React.useState('connecting'); // 'connecting'|'live'|'error'
  const [reloadKey, setReloadKey] = React.useState(0);

  const params = new URLSearchParams({ sourceName });
  if (quality) params.set('quality', quality);
  // Le reloadKey force le browser à refaire une requête HTTP (sinon il reste sur le flux mort)
  if (reloadKey) params.set('_r', String(reloadKey));
  const url = `/api/video/ndi/stream?${params.toString()}`;

  React.useEffect(() => {
    if (state !== 'error') return;
    const t = setTimeout(() => {
      setState('connecting');
      setReloadKey(k => k + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [state]);

  // Si la source change, on repart en connecting
  React.useEffect(() => {
    setState('connecting');
    setReloadKey(k => k + 1);
  }, [sourceName, quality]);

  return (
    <div style={outerStyle}>
      {/* L'<img> est toujours monté pour pouvoir recevoir onLoad ;
          on le masque tant que la 1ère frame n'est pas arrivée. */}
      <img
        key={reloadKey}
        src={url}
        alt={`NDI ${sourceName}`}
        onLoad={() => setState('live')}
        onError={() => setState('error')}
        style={{
          width: '100%', height: '100%', objectFit,
          display: state === 'live' ? 'block' : 'none'
        }}
      />
      {state === 'connecting' && (
        <StreamOverlay
          icon={<Spinner />}
          title="NDI"
          message={`Connexion à ${sourceName}…`}
        />
      )}
      {state === 'error' && (
        <StreamOverlay
          icon="⚠️"
          title="Pas de signal"
          message="Reconnexion automatique…"
        />
      )}
    </div>
  );
}

function StreamOverlay({ icon, title, message }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '4cqh 4cqw',
      color: 'rgba(255,255,255,0.7)',
      fontFamily: 'Inter, system-ui, sans-serif',
      textAlign: 'center',
      containerType: 'size'
    }}>
      <div style={{ fontSize: '8cqh', lineHeight: 1, opacity: 0.8 }}>{icon}</div>
      <div style={{ fontSize: '4cqh', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{title}</div>
      {message && <div style={{ fontSize: '3cqh', opacity: 0.7 }}>{message}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '8cqh', height: '8cqh', animation: 'ndi-spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M22 12a10 10 0 0 0-10-10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <style>{`@keyframes ndi-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </svg>
  );
}

function Placeholder({ style, icon, title, message, badge }) {
  return (
    <div style={{
      ...style,
      flexDirection: 'column', gap: 8,
      color: 'rgba(255,255,255,0.55)',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '4cqh 4cqw',
      textAlign: 'center',
      containerType: 'size'
    }}>
      <div style={{ fontSize: '8cqh', lineHeight: 1, opacity: 0.7 }}>{icon}</div>
      <div style={{ fontSize: '4cqh', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
        {title}
        {badge && (
          <span style={{
            marginLeft: 8, fontSize: '2cqh',
            padding: '0.4cqh 1cqw',
            background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.1em',
            verticalAlign: 'middle', fontWeight: 600
          }}>{badge}</span>
        )}
      </div>
      {message && <div style={{ fontSize: '3cqh', opacity: 0.7 }}>{message}</div>}
    </div>
  );
}
