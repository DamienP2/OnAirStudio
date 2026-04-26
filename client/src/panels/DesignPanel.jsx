import React, { useEffect, useState } from 'react';
import { socket } from '../socket';
import { useTr } from '../hooks/useT';
import { useDesignerState } from '../designer/useDesignerState';
import Palette from '../designer/Palette';
import Canvas from '../designer/Canvas';
import Inspector from '../designer/Inspector';
import Toolbar from '../designer/Toolbar';
import AssetGallery from '../designer/AssetGallery';
import OptionGroup from '../components/OptionGroup';
import { apiList, apiGet, apiCreate, apiUpdate, apiDelete, apiActivate, apiListFactoryTemplates } from '../store/templateStore';
import { loadImageNaturalSize, fitDimensions, reshapeToRatio } from '../designer/imageUtils';
import { TimerProvider } from '../store/TimerContext';
import TemplateObject from '../template-objects';
import FitToContainer from '../components/FitToContainer';

export default function DesignPanel() {
  const tr = useTr();
  const {
    state, loadTemplate, select, addObject, updateObject, deleteSelected,
    duplicateSelected, undo, redo, updateCanvas,
    beginTransaction, endTransaction
  } = useDesignerState();

  const [list, setList] = useState({ activeRunningTemplateId: null, activeStoppedTemplateId: null, templates: [] });
  // Distingue le 1er chargement (où il faut afficher "Chargement…") du cas où
  // l'API a répondu mais qu'il n'y a aucun template (où il faut afficher l'empty-state).
  const [listLoaded, setListLoaded] = useState(false);
  // Persiste le template en cours d'édition entre les reloads / onglets.
  const LAST_ID_KEY = 'onair.designer.lastEditedTemplateId';
  const [currentId, _setCurrentId] = useState(() => localStorage.getItem(LAST_ID_KEY));
  const setCurrentId = (id) => {
    if (id) localStorage.setItem(LAST_ID_KEY, id);
    else localStorage.removeItem(LAST_ID_KEY);
    _setCurrentId(id);
  };
  const [dirty, setDirty] = useState(false);
  // showAssets : null = fermé, sinon { kind: 'image'|'video' }
  const [showAssets, setShowAssets] = useState(null);
  const openAssetGallery = (opts = {}) => setShowAssets({ kind: opts.kind || 'image' });

  // --- New template modal state ---
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplatePreset, setNewTemplatePreset] = useState('16:9');
  const [newTemplateCustomW, setNewTemplateCustomW] = useState(1920);
  const [newTemplateCustomH, setNewTemplateCustomH] = useState(1080);
  // 'blank' (vierge) ou slug d'un factory chargé depuis le serveur.
  const [newFactorySlug, setNewFactorySlug] = useState('blank');
  const [newTemplateCategory, setNewTemplateCategory] = useState('horloge');
  const [factoryList, setFactoryList] = useState([]);

  // --- Preview modal state (Fix 3) ---
  const [showPreview, setShowPreview] = useState(false);

  // --- Info/Error modal state (Fix 5) ---
  const [infoModal, setInfoModal] = useState(null); // { title, message, type: 'info'|'error'|'success' }

  // --- Confirm modal state (Fix 5) ---
  const [confirmState, setConfirmState] = useState(null); // { message, resolve }

  function confirmDialog(message) {
    return new Promise(resolve => {
      setConfirmState({ message, resolve });
    });
  }

  const RATIOS = {
    '16:9':   { width: 1920, height: 1080 },
    '21:9':   { width: 2560, height: 1080 },
    '4:3':    { width: 1440, height: 1080 },
    '1:1':    { width: 1080, height: 1080 },
    '9:16':   { width: 1080, height: 1920 },
    '3:4':    { width: 1080, height: 1440 },
    'custom': null
  };

  const refreshList = async () => {
    try {
      const idx = await apiList();
      setList(idx);
      setListLoaded(true);
      if (idx.templates.length) {
        // Si currentId existe et est toujours dans la liste, on garde.
        // Sinon fallback sur le template actif, puis sur le premier.
        const savedExists = currentId && idx.templates.some(t => t.id === currentId);
        if (!savedExists) setCurrentId(idx.activeRunningTemplateId || idx.activeStoppedTemplateId || idx.templates[0].id);
      } else {
        // Aucun template : on s'assure de ne pas garder un currentId obsolète
        // (cas où le dernier template vient d'être supprimé/reset).
        if (currentId) setCurrentId(null);
      }
    } catch (e) {
      // ignore — si pas d'auth, AdminAuthGate intercepte en amont
      setListLoaded(true);
    }
  };

  useEffect(() => {
    refreshList();
    const h = () => refreshList();
    socket.on('templatesListChanged', h);
    return () => socket.off('templatesListChanged', h);
  }, []);

  useEffect(() => {
    if (!currentId) return;
    apiGet(currentId).then(t => { loadTemplate(t); setDirty(false); }).catch(() => {});
  }, [currentId]);

  const selectedObj = state.selectedIds.length === 1
    ? state.template?.objects.find(o => o.id === state.selectedIds[0]) || null
    : null;

  const handleUpdateObj = (changes) => {
    if (!selectedObj) return;
    updateObject(selectedObj.id, changes);
    setDirty(true);
  };

  const handleDeleteSel = () => { deleteSelected(); setDirty(true); };
  const handleAddObj = async (obj) => {
    // Pour les widgets dont les dimensions doivent matcher le ratio natif d'une
    // image (logo studio + image avec asset), on lit la taille réelle avant
    // d'ajouter pour éviter une déformation visuelle au 1er render.
    if (obj.type === 'logo') {
      const natural = await loadImageNaturalSize('/api/branding/logo', { width: 200, height: 100 });
      const fitted = fitDimensions(natural, 300);
      obj = { ...obj, width: fitted.width, height: fitted.height };
    } else if (obj.type === 'image' && obj.props?.filename) {
      const natural = await loadImageNaturalSize(`/uploads/${obj.props.filename}`);
      const fitted = fitDimensions(natural);
      obj = { ...obj, width: fitted.width, height: fitted.height };
    }
    addObject(obj);
    setDirty(true);
  };

  const handleUpdateCanvas = (changes) => {
    updateCanvas(changes);
    setDirty(true);
  };

  const handleUpdateTemplateName = (name) => {
    if (!state.template) return;
    const current = state.template;
    apiUpdate(current.id, { ...current, name })
      .then(() => { refreshList(); apiGet(current.id).then(t => loadTemplate(t)); })
      .catch(e => setInfoModal({ type: 'error', message: e.message }));
  };

  // Patch arbitraire des métadonnées top-level du template (catégorie, etc.).
  // Le serveur peut rejeter ou réorganiser les slots actifs si la catégorie change.
  const handleUpdateTemplateMeta = (patch) => {
    if (!state.template) return;
    const current = state.template;
    apiUpdate(current.id, { ...current, ...patch })
      .then(() => { refreshList(); apiGet(current.id).then(t => loadTemplate(t)); })
      .catch(e => setInfoModal({ type: 'error', message: e.message }));
  };

  // --- Auto-save state ---
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const saveTimerRef = React.useRef(null);
  const lastErrorRef = React.useRef(null);

  const performSave = React.useCallback(async () => {
    if (!state.template) return;
    setSaveStatus('saving');
    try {
      await apiUpdate(state.template.id, {
        name: state.template.name,
        canvas: state.template.canvas,
        objects: state.template.objects
      });
      setDirty(false);
      setSaveStatus('saved');
      lastErrorRef.current = null;
      // Revenir à idle après 2s
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000);
    } catch (e) {
      setSaveStatus('error');
      lastErrorRef.current = e.message;
    }
  }, [state.template]);

  // Auto-save debounced quand `dirty` devient true
  React.useEffect(() => {
    if (!dirty || !state.template) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { performSave(); }, 1200);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [dirty, state.template, performSave]);

  // Sauvegarde manuelle immédiate (Ctrl+S) — flush le debounce
  const handleSave = async () => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    await performSave();
  };

  // Modal de choix d'un template de remplacement (utilisé pour la désactivation
  // d'un template — on choisit qui prend sa place sur ce slot).
  const [replaceState, setReplaceState] = useState(null);
  // { mode: 'running'|'stopped', currentName: string }

  const handleToggleActive = async (mode, active) => {
    if (!currentId) return;

    if (active) {
      // Activation : si un autre template est déjà actif sur ce slot → confirmation avec son nom
      const currentSlotId = mode === 'running' ? list.activeRunningTemplateId : list.activeStoppedTemplateId;
      if (currentSlotId && currentSlotId !== currentId) {
        const currentName = list.templates.find(t => t.id === currentSlotId)?.name || '?';
        const slotLabel = mode === 'running' ? 'chrono en cours / en pause' : "chrono à l'arrêt";
        const ok = await confirmDialog(
          `« ${currentName} » est actuellement actif pour le ${slotLabel}.\nActiver ce template à la place ?`
        );
        if (!ok) return;
      }
      if (dirty && !(await confirmDialog('Modifications non enregistrées — activer quand même ?'))) return;
      try { await apiActivate(currentId, { mode, active: true }); await refreshList(); }
      catch (e) { setInfoModal({ type: 'error', message: 'Erreur activation : ' + e.message }); }
      return;
    }

    // Désactivation : ouvrir le modal pour choisir un remplaçant
    setReplaceState({ mode, currentName: state.template?.name || '?' });
  };

  // Active le template choisi pour le slot spécifié (depuis le modal de remplacement)
  const handleReplaceWith = async (replacementId) => {
    const { mode } = replaceState;
    setReplaceState(null);
    if (!replacementId) return;
    try {
      await apiActivate(replacementId, { mode, active: true });
      await refreshList();
    } catch (e) {
      setInfoModal({ type: 'error', message: 'Erreur activation : ' + e.message });
    }
  };

  const handleNewClick = async () => {
    setNewTemplateName('');
    setNewTemplatePreset('16:9');
    setNewFactorySlug('blank');
    setNewTemplateCategory('horloge');
    setShowNewTemplateModal(true);
    // Charge la liste des factory templates dispos (lecture publique, sans auth)
    try { setFactoryList(await apiListFactoryTemplates()); }
    catch { setFactoryList([]); }
  };

  const handleConfirmNewTemplate = async () => {
    if (!newTemplateName.trim()) { setInfoModal({ type: 'error', message: 'Nom requis' }); return; }
    try {
      // Cas 1 : modèle factory choisi → on délègue au serveur (qui clone canvas + objects + category)
      if (newFactorySlug && newFactorySlug !== 'blank') {
        const t = await apiCreate({ name: newTemplateName.trim(), factorySlug: newFactorySlug });
        setCurrentId(t.id);
        setShowNewTemplateModal(false);
        await refreshList();
        return;
      }
      // Cas 2 : création vierge avec format choisi
      const canvasSize = newTemplatePreset === 'custom'
        ? { width: newTemplateCustomW, height: newTemplateCustomH }
        : RATIOS[newTemplatePreset];
      const NICE_STEPS = [10, 20, 25, 50, 60, 80, 100, 120, 160, 200];
      const raw = Math.min(canvasSize.width, canvasSize.height) / 20;
      const gridSize = NICE_STEPS.reduce((best, v) =>
        Math.abs(v - raw) < Math.abs(best - raw) ? v : best, NICE_STEPS[0]);
      // Plus de repères X/Y au centre par défaut — ils sont couverts par les
      // repères système "Milieux" (¼/½/¾) qu'on active d'office, en plus des
      // marges 25 px. L'utilisateur peut toujours créer ses propres repères.
      const canvas = {
        ...canvasSize,
        backgroundColor: '#000000',
        backgroundImage: null,
        gridEnabled: true,
        gridSize,
        gridColor: '#FFFFFF',
        gridOpacity: 0.08,
        snapEnabled: true,
        showMargins: true,
        showMidGuides: true,
        guides: []
      };
      const t = await apiCreate({ name: newTemplateName.trim(), canvas, category: newTemplateCategory });
      setCurrentId(t.id);
      setShowNewTemplateModal(false);
      await refreshList();
    } catch (e) { setInfoModal({ type: 'error', message: e.message }); }
  };

  const handleDuplicate = async () => {
    if (!state.template) return;
    try {
      const copy = await apiCreate({
        name: `${state.template.name} (copie)`,
        canvas: state.template.canvas,
        category: state.template.category
      });
      await apiUpdate(copy.id, { objects: state.template.objects });
      setCurrentId(copy.id);
      await refreshList();
    } catch (e) { setInfoModal({ type: 'error', message: 'Erreur duplication : ' + e.message }); }
  };

  const handleDelete = async () => {
    if (!currentId) return;
    if (!(await confirmDialog(`Supprimer "${state.template?.name}" ?`))) return;
    try {
      await apiDelete(currentId);
      setCurrentId(list.activeRunningTemplateId || list.activeStoppedTemplateId);
      await refreshList();
    } catch (e) { setInfoModal({ type: 'error', message: 'Erreur suppression : ' + e.message }); }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        const t = await apiCreate({ name: `${parsed.name || 'Importé'}`, canvas: parsed.canvas });
        await apiUpdate(t.id, { objects: parsed.objects || [] });
        setCurrentId(t.id); await refreshList();
      } catch (e) { setInfoModal({ type: 'error', message: 'JSON invalide ou erreur serveur : ' + e.message }); }
    };
    input.click();
  };

  const handleExport = () => {
    if (!state.template) return;
    const blob = new Blob([JSON.stringify(state.template, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.template.id}.json`;
    a.click();
  };

  const handlePreview = () => setShowPreview(true);

  // Wrappers undo/redo qui marquent le template comme modifié pour relancer l'auto-save.
  const handleUndo = () => { undo(); setDirty(true); };
  const handleRedo = () => { redo(); setDirty(true); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && showPreview) { setShowPreview(false); return; }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') handleDeleteSel();
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); handleRedo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSelected(); setDirty(true); }
      // Flèches : déplace l'objet sélectionné de 1 px (10 px avec Shift).
      // Les ctrl/meta ne sont pas modifiés ici pour ne pas conflit avec les
      // raccourcis OS (par ex. ⌘← = page précédente sur Mac).
      else if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const sel = state.selectedIds.length === 1
          ? state.template?.objects.find(o => o.id === state.selectedIds[0])
          : null;
        if (!sel) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
        updateObject(sel.id, { x: sel.x + dx, y: sel.y + dy });
        setDirty(true);
      }
      else if (e.key === 'Escape') { select([]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, dirty, showPreview]);

  // 3 états possibles avant que le designer ne soit utilisable :
  //  • liste pas encore chargée → spinner discret
  //  • liste chargée mais vide → empty-state avec CTA "Nouveau template"
  //  • liste a des templates mais le template courant se charge encore → spinner
  const isEmpty = listLoaded && list.templates.length === 0;
  const isLoadingTemplate = !state.template && !isEmpty;

  return (
    <div className="flex flex-col h-full">
      {isEmpty ? (
        // Empty-state aligné sur le design "console" du SettingsPanel :
        // panneau plat sombre avec hairline 1px, eyebrow uppercase tracking-wide,
        // illustration discrète (mini-mosaïque opacity-30) et bouton bleu standard.
        <div className="flex-1 flex items-center justify-center p-6 bg-ink">
          <div className="bg-slate-950/40 border border-white/5 rounded-xl p-8 max-w-md w-full text-center">
            {/* Illustration : mini-mosaïque suggérant une bibliothèque de templates */}
            <div className="grid grid-cols-3 gap-1.5 w-fit mx-auto mb-5 opacity-30">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="w-7 h-4 rounded-sm bg-slate-600" />
              ))}
            </div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400/80 font-semibold mb-2">DESIGNER</p>
            <h3 className="text-2xl font-bold tracking-tight text-slate-50 mb-2">{tr({ fr: 'Aucun template', en: 'No templates' })}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              {tr({ fr: "Créez votre premier template pour commencer à composer l'affichage du studio.", en: "Create your first template to start composing the studio display." })}
            </p>
            <button
              type="button"
              onClick={handleNewClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded font-medium transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {tr({ fr: 'Nouveau template', en: 'New template' })}
            </button>
          </div>
        </div>
      ) : isLoadingTemplate ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          {tr({ fr: 'Chargement du template…', en: 'Loading template…' })}
        </div>
      ) : (
        <>
          <Toolbar
            templates={list.templates}
            activeRunningTemplateId={list.activeRunningTemplateId}
            activeStoppedTemplateId={list.activeStoppedTemplateId}
            currentTemplateId={currentId}
            onSelectTemplate={setCurrentId}
            saveStatus={saveStatus}
            onToggleActive={handleToggleActive}
            onNew={handleNewClick}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onImport={handleImport}
            onExport={handleExport}
            onOpenAssets={() => openAssetGallery()}
            onPreview={handlePreview}
            canUndo={state.undo.length > 0}
            canRedo={state.redo.length > 0}
            onUndo={handleUndo} onRedo={handleRedo}
            dirty={dirty}
          />
          <div className="flex flex-1 overflow-hidden">
            <Palette
              onAdd={handleAddObj}
              existingObjs={state.template?.objects || []}
              canvas={state.template?.canvas || { width: 1920, height: 1080 }}
            />
            <Canvas
              template={state.template}
              selectedIds={state.selectedIds}
              onSelect={select}
              onUpdate={(id, changes) => { updateObject(id, changes); setDirty(true); }}
              onUpdateCanvas={handleUpdateCanvas}
              onAdd={handleAddObj}
            />
            <Inspector
              object={selectedObj}
              onUpdate={handleUpdateObj}
              onDelete={handleDeleteSel}
              template={state.template}
              onUpdateCanvas={handleUpdateCanvas}
              onUpdateTemplateName={handleUpdateTemplateName}
              onUpdateTemplateMeta={handleUpdateTemplateMeta}
              onOpenAssetGallery={openAssetGallery}
              onBeginTx={beginTransaction}
              onEndTx={endTransaction}
            />
          </div>
        </>
      )}
      {showAssets && (
        <AssetGallery
          kind={showAssets.kind}
          onPick={async ({ assetId, filename }) => {
            // Mode édition : on assigne l'asset à l'objet sélectionné.
            // Pour une image, on recalcule W/H pour matcher le ratio natif de
            // la nouvelle image en gardant la dimension principale courante
            // (l'objet ne saute pas en taille).
            if (selectedObj && selectedObj.type === 'image' && showAssets.kind === 'image') {
              const natural = await loadImageNaturalSize(`/uploads/${filename}`);
              const ratio = natural.width / natural.height;
              const reshaped = reshapeToRatio(selectedObj.width, selectedObj.height, ratio);
              handleUpdateObj({ ...reshaped, props: { assetId, filename } });
            } else if (selectedObj && selectedObj.type === 'video' && showAssets.kind === 'video') {
              handleUpdateObj({ props: { assetId, filename } });
            } else if (showAssets.kind === 'video') {
              handleAddObj({
                id: `video-${Date.now()}`,
                type: 'video',
                x: 100, y: 100, width: 640, height: 360, rotation: 0, zIndex: 1,
                props: {
                  mode: 'recorded', recordedSource: 'upload',
                  assetId, filename,
                  autoplay: true, loop: true, muted: true, controls: false,
                  objectFit: 'cover', backgroundColor: '#000000', borderRadius: 0
                }
              });
            } else {
              // Nouvelle image — handleAddObj détectera le filename et adaptera W/H
              await handleAddObj({
                id: `image-${Date.now()}`,
                type: 'image',
                x: 100, y: 100, width: 300, height: 200, rotation: 0, zIndex: 1,
                props: { assetId, filename }
              });
            }
            setShowAssets(null);
          }}
          onClose={() => setShowAssets(null)}
        />
      )}

      {showNewTemplateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">{tr({ fr: 'Nouveau template', en: 'New template' })}</h3>

            {/* Modèle de base */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-2">{tr({ fr: 'Modèle de base', en: 'Base template' })}</label>
              <div className="grid grid-cols-2 gap-2">
                {/* Vierge — toujours présent */}
                <button type="button"
                  onClick={() => setNewFactorySlug('blank')}
                  className={`relative text-left px-3 py-2.5 rounded-md border text-xs font-medium transition-all ${
                    newFactorySlug === 'blank'
                      ? 'bg-blue-600/15 border-blue-500 text-white'
                      : 'bg-slate-900/70 border-white/5 hover:border-blue-500/40 text-slate-300'
                  }`}>
                  {newFactorySlug === 'blank' && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </span>
                  )}
                  <p className="font-semibold">{tr({ fr: 'Vierge', en: 'Blank' })}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{tr({ fr: 'Démarrer avec un canvas vide', en: 'Start with an empty canvas' })}</p>
                </button>
                {/* Factory templates dynamiques */}
                {factoryList.map(f => (
                  <button key={f.slug} type="button"
                    onClick={() => setNewFactorySlug(f.slug)}
                    title={f.description}
                    className={`relative text-left px-3 py-2.5 rounded-md border text-xs font-medium transition-all ${
                      newFactorySlug === f.slug
                        ? 'bg-blue-600/15 border-blue-500 text-white'
                        : 'bg-slate-900/70 border-white/5 hover:border-blue-500/40 text-slate-300'
                    }`}>
                    {newFactorySlug === f.slug && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      </span>
                    )}
                    <p className="font-semibold">{f.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      {f.description || `${f.objectsCount} objet${f.objectsCount > 1 ? 's' : ''}`}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Nom du template */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">{tr({ fr: 'Nom', en: 'Name' })}</label>
              <input
                type="text" value={newTemplateName} autoFocus
                onChange={e => setNewTemplateName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirmNewTemplate()}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-sm outline-none"
                placeholder={tr({ fr: 'ex: Matinale', en: 'e.g. Morning show' })}
              />
            </div>

            {/* Catégorie — uniquement pour un template vierge (les factory portent
                leur propre catégorie qui sera héritée automatiquement). */}
            {newFactorySlug === 'blank' && (
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">{tr({ fr: 'Catégorie', en: 'Category' })}</label>
                <OptionGroup
                  cols={2}
                  value={newTemplateCategory}
                  onChange={setNewTemplateCategory}
                  options={[
                    { value: 'horloge', label: tr({ fr: 'Mode actif', en: 'Active mode' }) },
                    { value: 'veille',  label: tr({ fr: 'Mode veille',  en: 'Idle mode' }) }
                  ]}
                />
                <p className="text-[10px] text-slate-500 mt-2">
                  {tr({
                    fr: <>Détermine sur quel slot ce template peut être activé : <strong className="text-slate-300">Mode actif</strong> = chrono actif, <strong className="text-slate-300">Mode veille</strong> = chrono à l'arrêt.</>,
                    en: <>Determines which slot this template can be activated for: <strong className="text-slate-300">Active mode</strong> = timer running, <strong className="text-slate-300">Idle mode</strong> = timer stopped.</>
                  })}
                </p>
              </div>
            )}

            {/* Format — uniquement pour un template vierge (les factory ont leur propre canvas) */}
            {newFactorySlug === 'blank' && (
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">{tr({ fr: 'Format du canvas', en: 'Canvas format' })}</label>
                <OptionGroup
                  cols={4}
                  value={newTemplatePreset}
                  onChange={setNewTemplatePreset}
                  options={Object.keys(RATIOS).map(k => ({
                    value: k,
                    label: k === 'custom' ? tr({ fr: 'Custom', en: 'Custom' }) : k
                  }))}
                />
                {newTemplatePreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">{tr({ fr: 'Largeur (px)', en: 'Width (px)' })}</label>
                      <input type="number" value={newTemplateCustomW}
                        onChange={e => setNewTemplateCustomW(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-md text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">{tr({ fr: 'Hauteur (px)', en: 'Height (px)' })}</label>
                      <input type="number" value={newTemplateCustomH}
                        onChange={e => setNewTemplateCustomH(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-md text-sm" />
                    </div>
                  </div>
                )}
                {newTemplatePreset !== 'custom' && (
                  <p className="text-xs text-slate-500 mt-2 font-mono">
                    {RATIOS[newTemplatePreset].width} × {RATIOS[newTemplatePreset].height} px
                  </p>
                )}
              </div>
            )}
            {newFactorySlug !== 'blank' && (
              <p className="text-[10px] text-slate-500 italic">
                {tr({ fr: 'Le format et le contenu sont copiés depuis le modèle. Vous pourrez modifier librement après création.', en: 'Format and content are copied from the template. You can edit freely after creation.' })}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
              <button type="button"
                onClick={() => setShowNewTemplateModal(false)}
                className="px-4 py-2 text-sm rounded-md bg-slate-800 hover:bg-slate-700">
                {tr({ fr: 'Annuler', en: 'Cancel' })}
              </button>
              <button type="button"
                onClick={handleConfirmNewTemplate}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-500 font-medium">
                {tr({ fr: 'Créer', en: 'Create' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal — header sobre + contenu scalé sur l'espace disponible
          (FitToContainer respecte la zone réelle, pas 100vh — sinon le bas
          est rogné par la barre du modal). */}
      {showPreview && state.template && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="bg-slate-900 border-b border-white/10 px-4 py-2 flex items-center justify-between flex-shrink-0">
            <div className="text-sm text-slate-300">
              Aperçu : <span className="font-semibold text-white">{state.template.name}</span>
              {dirty && <span className="ml-2 text-yellow-400 text-xs">(non enregistré)</span>}
            </div>
            <button
              onClick={() => setShowPreview(false)}
              title="Fermer (Échap)"
              className="px-3 py-1.5 text-sm rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Fermer
            </button>
          </div>
          <div className="flex-1 min-h-0 relative">
            <TimerProvider>
              <FitToContainer canvas={state.template.canvas}>
                {state.template.objects.map(obj => <TemplateObject key={obj.id} obj={obj} />)}
              </FitToContainer>
            </TimerProvider>
          </div>
        </div>
      )}

      {/* Modal de remplacement de template — choix d'un autre template pour reprendre le slot */}
      {replaceState && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-5 max-w-md w-full shadow-2xl shadow-black/50">
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-widest mb-1">
              Désactivation
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Tu désactives <span className="text-slate-100 font-medium">« {replaceState.currentName} »</span> pour
              le {replaceState.mode === 'running' ? 'chrono en cours / en pause' : 'chrono à l\'arrêt'}.
              <br/>Choisis le template qui prendra sa place :
            </p>
            <div className="space-y-1 max-h-72 overflow-y-auto mb-4 -mx-1 px-1">
              {(list.templates || []).filter(t => t.id !== currentId).length === 0 && (
                <p className="text-xs text-slate-500 italic px-2 py-3 text-center">
                  Aucun autre template disponible. Crée d'abord un nouveau template.
                </p>
              )}
              {(list.templates || []).filter(t => t.id !== currentId).map(t => (
                <button
                  key={t.id}
                  onClick={() => handleReplaceWith(t.id)}
                  className="w-full text-left px-3 py-2 bg-slate-800/60 hover:bg-blue-600 border border-white/5 hover:border-blue-500 rounded text-sm text-slate-200 hover:text-white transition-colors flex items-center justify-between gap-2"
                >
                  <span className="truncate">{t.name}</span>
                  <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReplaceState(null)}
                className="px-3 py-1.5 text-sm rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal (Fix 5) */}
      {confirmState && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-md w-full">
            <p className="text-slate-200 mb-6">{confirmState.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { confirmState.resolve(false); setConfirmState(null); }}
                className="px-4 py-2 text-sm rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
              >Annuler</button>
              <button
                onClick={() => { confirmState.resolve(true); setConfirmState(null); }}
                className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white"
              >Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Info/Error modal (Fix 5) */}
      {infoModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`bg-slate-900 border ${
            infoModal.type === 'error' ? 'border-red-500/40' : 'border-blue-500/30'
          } rounded-xl p-6 max-w-md w-full`}>
            {infoModal.title && <h3 className="text-lg font-semibold mb-2">{infoModal.title}</h3>}
            <p className={`text-sm ${infoModal.type === 'error' ? 'text-red-200' : 'text-slate-200'} mb-6 whitespace-pre-wrap`}>
              {infoModal.message}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setInfoModal(null)}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-500 text-white"
              >OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
