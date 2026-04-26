import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import { TimerProvider } from '../store/TimerContext';
import TemplateObject from '../template-objects';
import FitToViewport from '../components/FitToViewport';
import DocumentTitle from '../components/DocumentTitle';

function DisplayInner() {
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/templates/active');
        if (res.status === 404) { setTemplate(null); setError(null); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setTemplate(await res.json());
        setError(null);
      } catch (e) { setError(e.message); }
    }
    load();
    // templateChanged peut arriver avec `null` (aucun template actif sur le mode courant)
    const onTemplate = (t) => { setTemplate(t || null); setError(null); };
    socket.on('templateChanged', onTemplate);
    return () => socket.off('templateChanged', onTemplate);
  }, []);

  if (error) return <div style={{color:'white',background:'black',padding:24}}>Erreur chargement template : {error}</div>;
  // Aucun template actif sur le mode courant → écran noir (vide volontaire)
  if (!template) return <div style={{background:'#000', width:'100vw', height:'100vh'}} />;

  return (
    <FitToViewport canvas={template.canvas}>
      {template.objects.map(obj => <TemplateObject key={obj.id} obj={obj} />)}
    </FitToViewport>
  );
}

export default function Display() {
  return (
    <TimerProvider>
      <DocumentTitle page="Display" />
      <DisplayInner />
    </TimerProvider>
  );
}
