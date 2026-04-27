import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import FitToContainer from '../components/FitToContainer';
import OptionGroup from '../components/OptionGroup';
import TemplateObject from '../template-objects';
import { useT, useTr } from '../hooks/useT';
import { apiList, apiActivate } from '../store/templateStore';
import { useDialog } from '../components/Dialog';

/* SVG icons inline */
const IconPlay = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M8 5.14v14l11-7-11-7z"/>
  </svg>
);
const IconPause = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>
);
const IconStop = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M6 6h12v12H6z"/>
  </svg>
);
const IconResume = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M8 5.14v14l11-7-11-7z"/>
  </svg>
);
const IconChevronUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
  </svg>
);
const IconChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
  </svg>
);

/*==============================================
=            Composant Principal              =
===============================================*/

export default function ControlPanel() {
  const t = useT();
  const tr = useTr();
  const dialog = useDialog();
  /*----------  États  ----------*/
  const [timerState, setTimerState] = useState({
    isRunning: false,
    isPaused: false,
    remainingTime: 0,
    elapsedTime: 0,
    selectedDuration: '00:00:00'
  });
  // Tant qu'on n'a pas reçu un premier event timer du serveur, on traite les
  // boutons transport comme désactivés. Évite le flash vert/orange quand on
  // change d'onglet et que le state initial diffère de l'état serveur réel.
  const [hasTimerUpdate, setHasTimerUpdate] = useState(false);
  const [isOnAir, setIsOnAir] = useState(false);

  const [v3Templates, setV3Templates] = useState([]);
  const [v3ActiveRunning, setV3ActiveRunning] = useState(null);
  const [v3ActiveStopped, setV3ActiveStopped] = useState(null);
  // Chrono "lap" system — chaque clic sur Intermédiaire marque la fin d'une partie.
  // Les parties sont dérivées : { idx, wallStart, wallEnd, markIdx (pour suppression) }
  const [chronoStartWall, setChronoStartWall] = useState(null); // Date de début du chrono
  const [lapMarks, setLapMarks] = useState([]);                 // [{ id, wallTime }]
  const prevRunningRef = React.useRef(false);
  const [stopArmed, setStopArmed] = useState(false);
  const stopArmTimerRef = React.useRef(null);

  // Preview live : on choisit quel slot prévisualiser via un toggle
  // « Mode actif » (running) / « Mode veille » (stopped). Le user peut switcher
  // manuellement, mais à chaque transition du chrono (start/stop) le toggle
  // se replace automatiquement sur le mode correspondant — voir useEffect plus bas.
  // Persiste dans localStorage pour survivre au démontage du panneau (changement d'onglet).
  const [previewMode, setPreviewMode] = useState(() => {
    try {
      const saved = localStorage.getItem('control.previewMode');
      return saved === 'running' || saved === 'stopped' ? saved : 'running';
    } catch { return 'running'; }
  });
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    try { localStorage.setItem('control.previewMode', previewMode); } catch { /* ignore */ }
  }, [previewMode]);

  // Auto-bascule : start chrono → Mode actif, stop chrono → Mode veille.
  // Ne se déclenche qu'à la transition (changement de isRunning), pas au mount.
  // Le user peut donc switcher manuellement sans être réécrasé, et son choix
  // est conservé en navigant entre onglets.
  const prevIsRunningRef = React.useRef(timerState.isRunning);
  useEffect(() => {
    if (prevIsRunningRef.current !== timerState.isRunning) {
      setPreviewMode(timerState.isRunning ? 'running' : 'stopped');
      prevIsRunningRef.current = timerState.isRunning;
    }
  }, [timerState.isRunning]);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`/api/templates/active?mode=${previewMode}`)
        .then(r => (r.status === 404 ? null : r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(t => { if (!cancelled) setPreviewTemplate(t); })
        .catch(() => { if (!cancelled) setPreviewTemplate(null); });
    };
    load();
    const onListChanged = () => load();
    const onTplChanged = () => load();
    socket.on('templatesListChanged', onListChanged);
    socket.on('templateChanged', onTplChanged);
    return () => {
      cancelled = true;
      socket.off('templatesListChanged', onListChanged);
      socket.off('templateChanged', onTplChanged);
    };
  }, [previewMode]);

  // Charge la liste des templates (endpoint public — pas besoin d'auth admin).
  const loadV3Templates = async () => {
    try {
      const idx = await apiList();
      setV3Templates(idx.templates || []);
      setV3ActiveRunning(idx.activeRunningTemplateId);
      setV3ActiveStopped(idx.activeStoppedTemplateId);
    } catch (e) {
      console.error('Erreur chargement templates :', e);
      setV3Templates([]);
    }
  };

  useEffect(() => {
    loadV3Templates();
    const h = () => loadV3Templates();
    const hTemplate = () => loadV3Templates();
    socket.on('templatesListChanged', h);
    socket.on('templateChanged', hTemplate);
    return () => {
      socket.off('templatesListChanged', h);
      socket.off('templateChanged', hTemplate);
    };
  }, []);

  // mode: 'running' | 'stopped'
  const handleV3Switch = async (id, mode) => {
    if (!id) return;
    try {
      await apiActivate(id, { mode, active: true });
      if (mode === 'running') setV3ActiveRunning(id);
      else setV3ActiveStopped(id);
    } catch (e) { dialog.alert({ title: 'Erreur', message: e.message, kind: 'error' }); }
  };

  /*----------  Gestion des événements socket  ----------
   * Les handlers sont nommés pour pouvoir être désenregistrés individuellement
   * via socket.off(event, handler). Sinon socket.off(event) — sans ref — supprime
   * TOUS les handlers de cet event, cassant d'autres composants (TimerContext)
   * quand on change d'onglet.
   */
  useEffect(() => {
    const onTimerUpdate = (state) => {
      setTimerState(state);
      setHasTimerUpdate(true);
    };
    const onTimeUpdate = (state) => {
      setTimerState(state); // tick 1Hz
      setHasTimerUpdate(true);
    };
    const onOnAirUpdate = ({ isOnAir: newIsOnAir }) => setIsOnAir(newIsOnAir);

    socket.on('timerUpdate', onTimerUpdate);
    socket.on('timeUpdate', onTimeUpdate);
    socket.on('onAirStateUpdate', onOnAirUpdate);

    return () => {
      socket.off('timerUpdate', onTimerUpdate);
      socket.off('timeUpdate', onTimeUpdate);
      socket.off('onAirStateUpdate', onOnAirUpdate);
    };
  }, []);

  // Fonction pour formater le temps
  const formatTime = (seconds) => {
    if (typeof seconds !== 'number' || seconds < 0) {
      return '00:00:00';
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs]
      .map(v => String(v).padStart(2, '0'))
      .join(':');
  };

  // États pour la gestion du timer
  const [duration, setDuration] = useState('00:00:00');
  const [presetTimes, setPresetTimes] = useState([]);

  // Gestion des durées prédéfinies
  // Handlers nommés : socket.off(event, handler) ne retire QUE ce handler.
  // Sans la ref, socket.off(event) supprimerait TOUS les handlers — incluant
  // ceux de TimerContext (initialState) — et casserait l'hydratation après
  // chaque changement d'onglet.
  useEffect(() => {
    socket.emit('requestPresetTimes');

    const onDurationUpdate = (newDuration) => setDuration(newDuration);
    const onInitialStateLocal = (state) => setDuration(state.selectedDuration);
    const onPresetTimesUpdate = (times) => setPresetTimes(times);

    socket.on('durationUpdate', onDurationUpdate);
    socket.on('initialState', onInitialStateLocal);
    socket.on('presetTimesUpdate', onPresetTimesUpdate);

    return () => {
      socket.off('durationUpdate', onDurationUpdate);
      socket.off('initialState', onInitialStateLocal);
      socket.off('presetTimesUpdate', onPresetTimesUpdate);
    };
  }, []);

  // Mise à jour de l'affichage du réglage manuel quand le timer est en pause
  useEffect(() => {
    if (timerState.isRunning && timerState.isPaused) {
      // En pause, afficher le temps restant dans le réglage manuel
      const remainingSeconds = Math.max(0, timerState.remainingTime);
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;
      const remainingDuration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setDuration(remainingDuration);
    }
  }, [timerState.isRunning, timerState.isPaused, timerState.remainingTime]);

  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);
    socket.emit('durationSelected', newDuration);

    // Si le timer est en pause, on modifie le temps restant sans remettre à zéro le temps écoulé
    if (timerState.isRunning && timerState.isPaused) {
      const [hours, minutes, seconds] = newDuration.split(':').map(Number);
      const newTargetTime = (hours * 3600) + (minutes * 60) + seconds;
      socket.emit('updateRemainingTime', newTargetTime);
    } else {
      // Comportement normal pour les autres cas
      socket.emit('setTimer', newDuration);
    }
  };

  const handleStartStop = () => {
    if (!timerState.isRunning) {
      const [hours, minutes, seconds] = duration.split(':').map(Number);
      const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
      socket.emit('startTimer', totalSeconds);
      return;
    }
    // Chrono en route : premier clic = armer, deuxième clic dans les 3s = stop
    if (!stopArmed) {
      setStopArmed(true);
      if (stopArmTimerRef.current) clearTimeout(stopArmTimerRef.current);
      stopArmTimerRef.current = setTimeout(() => setStopArmed(false), 3000);
    } else {
      if (stopArmTimerRef.current) { clearTimeout(stopArmTimerRef.current); stopArmTimerRef.current = null; }
      setStopArmed(false);
      socket.emit('stopTimer');
    }
  };

  // Capture l'heure de début du chrono et reset les marks à chaque transition
  // false→true de isRunning. Idem on reset à l'arrêt.
  useEffect(() => {
    const wasRunning = prevRunningRef.current;
    if (timerState.isRunning && !wasRunning) {
      setChronoStartWall(new Date(Date.now() - (timerState.elapsedTime || 0) * 1000));
      setLapMarks([]);
    } else if (!timerState.isRunning && wasRunning) {
      setChronoStartWall(null);
      setLapMarks([]);
    }
    prevRunningRef.current = timerState.isRunning;
  }, [timerState.isRunning, timerState.elapsedTime]);

  // Nouveau temps intermédiaire — uniquement si chrono actif ET non pausé
  const handleLap = () => {
    if (!timerState.isRunning || timerState.isPaused) return;
    setLapMarks(prev => [...prev, { id: `lap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, wallTime: new Date() }]);
  };

  const handleDeleteLap = (markId) => {
    setLapMarks(prev => prev.filter(m => m.id !== markId));
  };

  // Dérivation des parties à partir de chronoStartWall + lapMarks
  const parties = React.useMemo(() => {
    if (!chronoStartWall || lapMarks.length === 0) return [];
    const result = [];
    let prev = chronoStartWall;
    lapMarks.forEach((mark, i) => {
      result.push({
        idx: i + 1,
        wallStart: prev,
        wallEnd: mark.wallTime,
        markId: mark.id
      });
      prev = mark.wallTime;
    });
    return result;
  }, [chronoStartWall, lapMarks]);

  // Nettoyage du timeout d'armement au démontage
  useEffect(() => () => {
    if (stopArmTimerRef.current) clearTimeout(stopArmTimerRef.current);
  }, []);

  // Format HH:MM:SS pour les heures absolues
  const fmtHMS = (d) => {
    const dd = d instanceof Date ? d : new Date(d);
    return `${String(dd.getHours()).padStart(2,'0')}:${String(dd.getMinutes()).padStart(2,'0')}:${String(dd.getSeconds()).padStart(2,'0')}`;
  };

  const handlePauseResume = () => {
    if (timerState.isRunning && !timerState.isPaused) {
      socket.emit('pauseTimer');
    } else if (timerState.isRunning && timerState.isPaused) {
      socket.emit('resumeTimer');
    }
  };

  /* Helper: button for digit adjustments */
  const DigitColumn = ({ getValue, onUp, onDown, disabled }) => (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={onUp}
        disabled={disabled}
        className={`p-1.5 rounded-md transition-colors focus:outline-none ${
          disabled
            ? 'bg-slate-800/40 text-slate-700 cursor-not-allowed'
            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
        }`}
      >
        <IconChevronUp />
      </button>
      <div className="text-4xl font-mono font-bold text-slate-50 w-10 text-center leading-none py-1">
        {getValue()}
      </div>
      <button
        onClick={onDown}
        disabled={disabled}
        className={`p-1.5 rounded-md transition-colors focus:outline-none ${
          disabled
            ? 'bg-slate-800/40 text-slate-700 cursor-not-allowed'
            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
        }`}
      >
        <IconChevronDown />
      </button>
    </div>
  );

  const isEditable = !timerState.isRunning || timerState.isPaused;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-ink text-slate-50">

      {/* ── Split : preview (gauche) + controls (droite) ────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── Preview live du template actif ── */}
        <div className="flex-1 min-w-0 bg-ink border-r border-white/5 relative flex items-center justify-center p-6">

          {previewTemplate ? (
            <div className="w-full h-full relative">
              <FitToContainer canvas={previewTemplate.canvas}>
                {(previewTemplate.objects || []).map(obj => <TemplateObject key={obj.id} obj={obj} />)}
              </FitToContainer>
            </div>
          ) : (
            // Empty-state aligné sur les autres panneaux (DesignPanel + Settings) :
            // panneau plat sombre avec hairline, illustration mini-mosaïque,
            // eyebrow cyan. Pas de bouton ici — Contrôle est une vue de pilotage,
            // la création se fait depuis l'onglet Design.
            <div className="bg-slate-950/40 border border-white/5 rounded-xl p-8 max-w-md w-full text-center">
              <div className="grid grid-cols-3 gap-1.5 w-fit mx-auto mb-5 opacity-30">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="w-7 h-4 rounded-sm bg-slate-600" />
                ))}
              </div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400/80 font-semibold mb-2">{tr({ fr: 'CONTROLE', en: 'CONTROL' })}</p>
              <h3 className="text-2xl font-bold tracking-tight text-slate-50 mb-2">{t('control.empty')}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{t('control.empty.hint')}</p>
            </div>
          )}
        </div>

        {/* ── Panneau de contrôle droit ── */}
        <aside className="w-[440px] flex-shrink-0 overflow-y-auto bg-[#06090f] border-l border-white/5 flex flex-col">

          {/* ── Toggle Mode + sélecteur template filtré par catégorie ──
              Le toggle bascule auto à chaque start/stop chrono ; le user peut
              quand même switcher manuellement pour configurer l'autre mode.
              Sous le toggle, on liste UNIQUEMENT les templates de la catégorie
              correspondante (horloge / veille) — pas de pollution avec des
              templates inadaptés. */}
          <div className="p-3 border-b border-white/5 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">Preview</div>
              <OptionGroup
                value={previewMode}
                onChange={setPreviewMode}
                options={[
                  {
                    value: 'running',
                    label: tr({ fr: 'Mode actif', en: 'Active mode' }),
                    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  },
                  {
                    value: 'stopped',
                    label: tr({ fr: 'Mode veille', en: 'Idle mode' }),
                    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>
                  }
                ]}
              />
            </div>

            {(() => {
              // Catégorie cible selon le mode courant
              const targetCat = previewMode === 'running' ? 'horloge' : 'veille';
              const filtered = v3Templates.filter(tpl => (tpl.category || 'horloge') === targetCat);
              const activeId = previewMode === 'running' ? v3ActiveRunning : v3ActiveStopped;
              if (filtered.length === 0) {
                return (
                  <p className="text-[11px] text-slate-500 italic leading-relaxed">
                    {tr({
                      fr: <>Aucun template <strong className="text-slate-400">{targetCat === 'horloge' ? 'Mode actif' : 'Mode veille'}</strong> disponible. Créez-en un dans l'onglet Design.</>,
                      en: <>No <strong className="text-slate-400">{targetCat === 'horloge' ? 'Active mode' : 'Idle mode'}</strong> template available. Create one in the Design tab.</>
                    })}
                  </p>
                );
              }
              return (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">
                    {tr({
                      fr: `Template actif ${targetCat === 'horloge' ? '(chrono actif)' : '(chrono à l\'arrêt)'}`,
                      en: `Active template ${targetCat === 'horloge' ? '(timer running)' : '(timer stopped)'}`
                    })}
                  </div>
                  <OptionGroup
                    cols={2}
                    value={activeId}
                    onChange={(id) => handleV3Switch(id, previewMode)}
                    options={filtered.map(tpl => ({
                      value: tpl.id,
                      label: tpl.name,
                      hint: tpl.name,
                      icon: targetCat === 'horloge'
                        ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>
                    }))}
                  />
                </div>
              );
            })()}
          </div>

          {/* Transport : 3 boutons côte à côte (Démarrer/Arrêter, Pause/Reprendre, Intermédiaire) */}
          <div className="p-3 border-b border-white/5">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleStartStop}
                disabled={!hasTimerUpdate || (timerState.targetTime === 0 && !timerState.isRunning)}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold rounded-md transition-colors ${
                  !hasTimerUpdate || (timerState.targetTime === 0 && !timerState.isRunning)
                    ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                    : !timerState.isRunning
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : stopArmed
                        ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse ring-2 ring-red-400/60'
                        : 'bg-red-700 hover:bg-red-600 text-white'
                }`}
              >
                {!timerState.isRunning ? <IconPlay /> : <IconStop />}
                {!timerState.isRunning ? t('control.start') : stopArmed ? t('control.confirm') : t('control.stop')}
              </button>
              <button
                onClick={handlePauseResume}
                disabled={!hasTimerUpdate || !timerState.isRunning}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold rounded-md transition-colors ${
                  !hasTimerUpdate || !timerState.isRunning
                    ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                    : timerState.isPaused
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {timerState.isPaused ? <IconResume /> : <IconPause />}
                {timerState.isPaused ? t('control.resume') : t('control.pause')}
              </button>
              <button
                onClick={handleLap}
                disabled={!hasTimerUpdate || !timerState.isRunning || timerState.isPaused}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold rounded-md border transition-colors ${
                  !hasTimerUpdate || !timerState.isRunning || timerState.isPaused
                    ? 'bg-slate-800/40 border-white/5 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-900/70 border-white/5 text-slate-300 hover:border-blue-500/40 hover:text-slate-50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M12 2v4M12 22v-4M22 12h-4M2 12h4" />
                  <circle cx="12" cy="12" r="9" /><polyline points="12,7 12,12 15,14" />
                </svg>
                {t('control.lap')}
              </button>
            </div>

            {/* Liste des « parties » — chaque partie = segment entre deux clics intermédiaires.
                Supprimer une partie = retirer le repère qui la termine, les parties voisines fusionnent. */}
            {parties.length > 0 && (
              <div className="mt-3 p-3 bg-slate-900/70 border border-white/5 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">{t('control.parts')}</span>
                  <button
                    onClick={() => setLapMarks([])}
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                  >{t('control.parts.clear_all')}</button>
                </div>
                <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                  {parties.map(p => {
                    const dur = Math.max(0, Math.floor((p.wallEnd.getTime() - p.wallStart.getTime()) / 1000));
                    return (
                      <li key={p.markId} className="flex items-center gap-2 text-xs bg-slate-950/50 rounded px-2 py-1.5 border border-white/5">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold w-14 flex-shrink-0">{t('control.part')} {p.idx}</span>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5 font-mono tabular-nums">
                          <span className="text-slate-200">{fmtHMS(p.wallStart)}</span>
                          <svg className="w-3 h-3 text-slate-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span className="text-slate-200">{fmtHMS(p.wallEnd)}</span>
                        </div>
                        <span className="font-mono font-bold text-blue-400 tabular-nums">{formatTime(dur)}</span>
                        <button
                          onClick={() => handleDeleteLap(p.markId)}
                          title={t('control.parts.delete_title')}
                          className="text-slate-600 hover:text-red-400 transition-colors ml-1 p-0.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 6l12 12M6 18L18 6" strokeLinecap="round"/></svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* ON AIR mega button.
              États :
                • Pas de relais USB → bouton désactivé, gris.
                • Chrono actif (running OU paused) → bouton FORCÉ rouge ON,
                  désactivé (le chrono prend la priorité, on ne peut pas couper).
                • Chrono arrêté → bouton libre, toggle manualOnAir côté serveur. */}
          {(() => {
            const relayOk = !!timerState.usbRelayStatus;
            const chronoActive = !!timerState.isRunning;
            const isLocked = chronoActive;
            const isDisabled = !relayOk || isLocked;
            const tooltip = !relayOk
              ? t('control.onair.tooltip_disabled')
              : isLocked
                ? tr({
                    fr: 'Verrouillé : le chrono force ON AIR. Arrête le chrono pour reprendre la main.',
                    en: 'Locked: the timer forces ON AIR. Stop the timer to regain control.'
                  })
                : undefined;
            return (
              <div className="p-4 border-b border-white/5">
                <button
                  onClick={() => { if (!isDisabled) socket.emit('setOnAir', !isOnAir); }}
                  disabled={isDisabled}
                  title={tooltip}
                  className={`relative w-full py-4 rounded-md border font-black text-xl uppercase tracking-widest transition-all duration-300 flex flex-col items-center justify-center gap-0.5 ${
                    !relayOk
                      ? 'bg-slate-900/60 border-white/5 text-slate-600 cursor-not-allowed'
                      : isOnAir
                        ? `bg-red-600 text-white border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.5)] ${isLocked ? 'cursor-not-allowed' : 'hover:bg-red-500'}`
                        : 'bg-slate-800/60 border-white/5 text-slate-400 hover:border-red-500/40 hover:text-red-400'
                  }`}
                >
                  <span>{t('control.onair')}</span>
                  {!relayOk && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 normal-case">
                      {t('control.onair.relay_disconnected')}
                    </span>
                  )}
                  {isLocked && relayOk && (
                    <span className="absolute top-1.5 right-2 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-white/70">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <span>{tr({ fr: 'chrono', en: 'timer' })}</span>
                    </span>
                  )}
                </button>
              </div>
            );
          })()}

          {/* Preset times */}
          {presetTimes.length > 0 && (
            <div className={`p-4 border-b border-white/5 transition-opacity ${!isEditable ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">{t('control.presets')}</div>
              <div className="grid grid-cols-3 gap-2">
                {presetTimes.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => { if (isEditable) handleDurationChange(preset.value); }}
                    disabled={!isEditable}
                    className={`relative py-2.5 px-2 rounded-md border transition-all text-sm font-medium ${
                      duration === preset.value
                        ? 'bg-blue-600/15 border-blue-500 text-white'
                        : 'bg-slate-900/70 border-white/5 hover:border-blue-500/40 text-slate-300 hover:text-slate-50'
                    }`}
                  >
                    {duration === preset.value && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      </div>
                    )}
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Réglage manuel digits */}
          <div className={`p-4 border-b border-white/5 transition-opacity ${!isEditable ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">{t('control.manual')}</div>
            <div className="flex justify-center items-center gap-1.5">
          {/* Heures - dizaines */}
          <DigitColumn
            getValue={() => duration.split(':')[0][0]}
            disabled={!isEditable}
            onUp={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(h / 10);
              const newH = (((t + 1) % 3) * 10) + (h % 10);
              if (newH < 24) handleDurationChange(`${String(newH).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
            }}
            onDown={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(h / 10);
              const newH = ((t > 0 ? t - 1 : 2) * 10) + (h % 10);
              if (newH < 24) handleDurationChange(`${String(newH).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
            }}
          />
          {/* Heures - unités */}
          <DigitColumn
            getValue={() => duration.split(':')[0][1]}
            disabled={!isEditable}
            onUp={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(h / 10), u = h % 10;
              const newH = t * 10 + ((u + 1) % 10);
              if (newH < 24) handleDurationChange(`${String(newH).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
            }}
            onDown={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(h / 10), u = h % 10;
              const newH = t * 10 + (u > 0 ? u - 1 : 9);
              if (newH < 24) handleDurationChange(`${String(newH).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
            }}
          />

          <div className="text-2xl font-mono font-bold text-slate-700 mb-0.5 select-none">:</div>

          {/* Minutes - dizaines */}
          <DigitColumn
            getValue={() => duration.split(':')[1][0]}
            disabled={!isEditable}
            onUp={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(m / 10);
              const newM = ((t + 1) % 6) * 10 + (m % 10);
              handleDurationChange(`${String(h).padStart(2,'0')}:${String(newM).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
            }}
            onDown={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(m / 10);
              const newM = (t > 0 ? t - 1 : 5) * 10 + (m % 10);
              handleDurationChange(`${String(h).padStart(2,'0')}:${String(newM).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
            }}
          />
          {/* Minutes - unités */}
          <DigitColumn
            getValue={() => duration.split(':')[1][1]}
            disabled={!isEditable}
            onUp={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(m / 10), u = m % 10;
              handleDurationChange(`${String(h).padStart(2,'0')}:${String(t * 10 + ((u + 1) % 10)).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
            }}
            onDown={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(m / 10), u = m % 10;
              handleDurationChange(`${String(h).padStart(2,'0')}:${String(t * 10 + (u > 0 ? u - 1 : 9)).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
            }}
          />

          <div className="text-2xl font-mono font-bold text-slate-700 mb-0.5 select-none">:</div>

          {/* Secondes - dizaines */}
          <DigitColumn
            getValue={() => duration.split(':')[2][0]}
            disabled={!isEditable}
            onUp={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(s / 10);
              const newS = ((t + 1) % 6) * 10 + (s % 10);
              handleDurationChange(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(newS).padStart(2,'0')}`);
            }}
            onDown={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(s / 10);
              const newS = (t > 0 ? t - 1 : 5) * 10 + (s % 10);
              handleDurationChange(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(newS).padStart(2,'0')}`);
            }}
          />
          {/* Secondes - unités */}
          <DigitColumn
            getValue={() => duration.split(':')[2][1]}
            disabled={!isEditable}
            onUp={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(s / 10), u = s % 10;
              handleDurationChange(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(t * 10 + ((u + 1) % 10)).padStart(2,'0')}`);
            }}
            onDown={() => {
              if (!isEditable) return;
              const [h, m, s] = duration.split(':').map(Number);
              const t = Math.floor(s / 10), u = s % 10;
              handleDurationChange(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(t * 10 + (u > 0 ? u - 1 : 9)).padStart(2,'0')}`);
            }}
          />
        </div>
      </div>

        </aside>
      </div>

    </div>
  );
}
