import React, { useState, useRef, useEffect } from 'react';
import { useT, useTr } from '../hooks/useT';

/* Icônes SVG */
const Icon = ({ d, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const IconPlus     = () => <Icon d="M12 5v14m-7-7h14" />;
const IconUndo     = () => <Icon d="M3 7v6h6M3 13a9 9 0 1 0 3-6.7" />;
const IconRedo     = () => <Icon d="M21 7v6h-6M21 13a9 9 0 1 1-3-6.7" />;
const IconPreview  = () => <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />;
const IconImage    = () => <Icon d="M3 3h18v18H3z M8 11l3 3 7-7" />;
const IconSave     = () => <Icon d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M7 3v7h11 M7 21v-7h10v7" />;
const IconActivate = () => <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />;
const IconDuplicate = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IconDots = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

function DropdownMenu({ buttonContent, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-2 py-1.5 bg-slate-800/60 text-slate-200 hover:text-white hover:bg-slate-700 rounded-md border border-white/5"
      >
        {buttonContent}
      </button>
      {open && (
        <div className={`absolute top-full mt-1 ${align === 'right' ? 'right-0' : 'left-0'} bg-black border border-white/20 rounded-lg shadow-2xl shadow-black/80 py-1 min-w-[200px] z-30`}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, disabled, danger, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-2.5 text-sm font-medium bg-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? 'text-red-300 hover:bg-red-500/15 hover:text-red-200'
          : 'text-slate-100 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />;
}

export default function Toolbar({
  templates,
  activeRunningTemplateId, activeStoppedTemplateId,
  currentTemplateId,
  onSelectTemplate, saveStatus, onToggleActive, onNew, onDuplicate, onDelete,
  onImport, onExport, onOpenAssets, onPreview,
  canUndo, canRedo, onUndo, onRedo
}) {
  const t = useT();
  const tr = useTr();
  const activeRunning = currentTemplateId && currentTemplateId === activeRunningTemplateId;
  const activeStopped = currentTemplateId && currentTemplateId === activeStoppedTemplateId;
  const hasAnyActivation = activeRunning || activeStopped;
  // Catégorie du template courant — détermine quel bouton d'activation est
  // pertinent (horloge → slot running ; veille → slot stopped). On masque
  // l'autre pour éviter une activation incohérente côté serveur.
  const currentTemplateMeta = templates && templates.find(tpl => tpl.id === currentTemplateId);
  const currentCategory = currentTemplateMeta && currentTemplateMeta.category === 'veille' ? 'veille' : 'horloge';

  return (
    <div className="bg-[#06090f]/95 backdrop-blur border-b border-white/10 px-3 py-2 flex items-center gap-2 flex-shrink-0">

      {/* 1. Nouveau */}
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm rounded-md transition-colors"
        title={t('designer.new')}
      >
        <IconPlus /> {t('designer.new')}
      </button>

      {/* 2. Sélecteur template — groupé par catégorie via <optgroup>.
          Le navigateur natif affiche les labels de groupe en gras italique
          avec un retrait visuel pour les options — séparation claire entre
          "Horloge" et "Veille" sans rien customiser. */}
      {(() => {
        const horlogeList = templates.filter(tpl => (tpl.category || 'horloge') === 'horloge');
        const veilleList  = templates.filter(tpl => tpl.category === 'veille');
        const renderOption = (tpl) => {
          const isActive =
            (tpl.id === activeRunningTemplateId) ||
            (tpl.id === activeStoppedTemplateId);
          // Petit rond plein unicode juste après le nom quand le template est
          // actif sur son slot. Discret et sans emoji.
          return (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}{isActive ? ' ●' : ''}
            </option>
          );
        };
        return (
          <select
            value={currentTemplateId || ''}
            onChange={e => onSelectTemplate(e.target.value)}
            className="bg-slate-900 text-slate-100 rounded-md px-3 py-1.5 text-sm border border-white/10 focus:border-blue-500 focus:outline-none min-w-[220px]"
            title={t('designer.template')}
          >
            {horlogeList.length > 0 && (
              <optgroup label={tr({ fr: '── Mode actif ──', en: '── Active mode ──' })}>
                {horlogeList.map(renderOption)}
              </optgroup>
            )}
            {veilleList.length > 0 && (
              <optgroup label={tr({ fr: '── Mode veille ──', en: '── Idle mode ──' })}>
                {veilleList.map(renderOption)}
              </optgroup>
            )}
          </select>
        );
      })()}

      {/* 3. Dupliquer (icône seule) */}
      <button
        onClick={onDuplicate}
        className="p-1.5 bg-slate-800/60 text-slate-200 hover:text-white hover:bg-slate-700 rounded-md border border-white/5"
        title={t('designer.duplicate')}
      >
        <IconDuplicate />
      </button>

      {/* 4. Aperçu */}
      <button
        onClick={onPreview}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 text-slate-200 hover:text-white hover:bg-slate-700 text-sm rounded-md border border-white/5"
        title={t('designer.preview.title')}
      >
        <IconPreview /> {t('designer.preview')}
      </button>

      {/* Bouton Activer — un seul bouton texte qui s'adresse au slot
          correspondant à la catégorie du template (horloge → running,
          veille → stopped). État : "Activer" si pas actif, "Activé" sinon. */}
      {(() => {
        const slot = currentCategory === 'veille' ? 'stopped' : 'running';
        const isActive = slot === 'running' ? activeRunning : activeStopped;
        return (
          <button
            onClick={() => onToggleActive(slot, !isActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              isActive
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                : 'bg-slate-800/60 hover:bg-blue-600/30 text-slate-200 hover:text-white border-white/10 hover:border-blue-500/40'
            }`}
            title={isActive
              ? tr({
                  fr: `Actif — ce template s'affiche sur le studio quand le chrono est ${slot === 'running' ? 'en cours' : 'à l\'arrêt'}. Clic pour désigner un remplaçant.`,
                  en: `Active — this template shows on the studio when the timer is ${slot === 'running' ? 'running' : 'stopped'}. Click to pick a replacement.`
                })
              : tr({
                  fr: `Activer ce template pour le ${slot === 'running' ? 'Mode actif (chrono actif)' : 'Mode veille (chrono à l\'arrêt)'}.`,
                  en: `Activate this template for ${slot === 'running' ? 'Active mode (timer running)' : 'Idle mode (timer stopped)'}.`
                })}
          >
            {/* Icône : check pour "Activé" (validé), bolt pour "Activer" (action). */}
            {isActive ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            )}
            <span>{isActive ? tr({ fr: 'Activé', en: 'Active' }) : tr({ fr: 'Activer', en: 'Activate' })}</span>
          </button>
        );
      })()}

      {/* 7. Supprimer (icône seule, danger, désactivé si template actif) */}
      <button
        onClick={onDelete}
        disabled={hasAnyActivation}
        title={hasAnyActivation ? tr({ fr: 'Désactivez le template avant de le supprimer', en: 'Deactivate the template before deleting it' }) : t('designer.delete')}
        className="p-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-300 hover:text-red-100 rounded-md border border-red-500/20 hover:border-red-500/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-900/30 disabled:hover:text-red-300"
      >
        <IconTrash />
      </button>

      <Separator />

      {/* Undo / Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-1.5 bg-slate-800/60 text-slate-200 hover:text-white hover:bg-slate-700 rounded-md border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
        title={t('designer.undo')}
      >
        <IconUndo />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-1.5 bg-slate-800/60 text-slate-200 hover:text-white hover:bg-slate-700 rounded-md border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
        title={t('designer.redo')}
      >
        <IconRedo />
      </button>

      {/* Flex grow pour pousser à droite */}
      <div className="flex-1" />

      {/* Indicateur d'auto-enregistrement — remplace le bouton Enregistrer */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md select-none ${
          saveStatus === 'saving'
            ? 'text-amber-300 bg-amber-500/10 border border-amber-500/30'
            : saveStatus === 'saved'
            ? 'text-green-300 bg-green-500/10 border border-green-500/30'
            : saveStatus === 'error'
            ? 'text-red-300 bg-red-500/10 border border-red-500/30'
            : 'text-slate-400 bg-slate-800/60 border border-white/5'
        }`}
        title={
          saveStatus === 'saving' ? t('designer.save.saving')
          : saveStatus === 'saved'  ? t('designer.save.saved')
          : saveStatus === 'error'  ? t('designer.save.error')
          : t('designer.save.idle')
        }
      >
        {saveStatus === 'saving' && (
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
          </svg>
        )}
        {saveStatus === 'saved' && (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
        {saveStatus === 'error' && (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
        {saveStatus === 'idle' && (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        )}
        <span>
          {saveStatus === 'saving' ? t('designer.save.saving')
           : saveStatus === 'saved' ? t('designer.save.saved')
           : saveStatus === 'error' ? t('designer.save.error')
           : t('designer.save.idle')}
        </span>
      </div>

      {/* Menu kebab — actions secondaires (Import / Export) */}
      <DropdownMenu buttonContent={<IconDots />}>
        {(close) => (
          <>
            <MenuItem onClick={() => { onImport(); close(); }}>{t('designer.import')}</MenuItem>
            <MenuItem onClick={() => { onExport(); close(); }}>{t('designer.export')}</MenuItem>
          </>
        )}
      </DropdownMenu>
    </div>
  );
}
