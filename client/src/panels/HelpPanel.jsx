import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../hooks/useT';

// Page d'aide — destinée aux UTILISATEURS du studio (présentateurs,
// opérateurs). Le contenu technique (API REST, Socket.IO, câblage relais,
// scripts d'installation) est volontairement absent — il appartient à la
// documentation technique séparée pour les installateurs.
//
// Layout type wiki : sidebar de navigation à gauche + zone de contenu à
// droite. Une seule section visible à la fois (state + scroll au top).

const APP_VERSION = (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev');

// ── Sections ────────────────────────────────────────────────────────────────
// Chaque section porte un titre et un groupe bilangue. La sidebar affiche les
// labels selon la langue courante (settings.language).
const SECTIONS = [
  { id: 'overview',   group: { fr: 'Démarrer',     en: 'Get started' },   title: { fr: 'Vue d\'ensemble',     en: 'Overview' },          icon: 'home' },
  { id: 'quickstart', group: { fr: 'Démarrer',     en: 'Get started' },   title: { fr: 'Démarrage rapide',    en: 'Quickstart' },        icon: 'rocket' },
  { id: 'control',    group: { fr: 'Onglets',      en: 'Tabs' },          title: { fr: 'Contrôle',            en: 'Control' },           icon: 'play' },
  { id: 'design',     group: { fr: 'Onglets',      en: 'Tabs' },          title: { fr: 'Design',              en: 'Design' },            icon: 'layout' },
  { id: 'calendars',  group: { fr: 'Onglets',      en: 'Tabs' },          title: { fr: 'Calendriers',         en: 'Calendars' },         icon: 'calendar' },
  { id: 'settings',   group: { fr: 'Onglets',      en: 'Tabs' },          title: { fr: 'Réglages',            en: 'Settings' },          icon: 'sliders' },
  { id: 'wiring',     group: { fr: 'Studio',       en: 'Studio' },        title: { fr: 'Connexions ON AIR',   en: 'ON AIR wiring' },     icon: 'lamp' },
  { id: 'objects',    group: { fr: 'Designer',     en: 'Designer' },      title: { fr: 'Objets disponibles',  en: 'Available objects' }, icon: 'shapes' },
  { id: 'palette',    group: { fr: 'Designer',     en: 'Designer' },      title: { fr: 'Palette de couleurs', en: 'Color palette' },     icon: 'droplet' },
  { id: 'streamdeck', group: { fr: 'Intégrations', en: 'Integrations' },  title: { fr: 'Stream Deck',         en: 'Stream Deck' },       icon: 'streamdeck' },
  { id: 'shortcuts',  group: { fr: 'Référence',    en: 'Reference' },     title: { fr: 'Raccourcis clavier',  en: 'Keyboard shortcuts' }, icon: 'keyboard' },
  { id: 'faq',        group: { fr: 'Référence',    en: 'Reference' },     title: { fr: 'Dépannage',           en: 'Troubleshooting' },   icon: 'help' }
];

const Icons = {
  home:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  rocket:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
  play:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  layout:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  sliders:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
  shapes:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="3.5"/><rect x="13" y="3" width="8" height="8" rx="1"/><path d="M5 14l4 7h-8z"/><rect x="13" y="14" width="8" height="8" rx="1"/></svg>,
  droplet:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
  keyboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="6" y1="14" x2="6" y2="14"/><line x1="18" y1="14" x2="18" y2="14"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
  help:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  lamp:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7 4 4 0 0 1 1.5 3.3h5a4 4 0 0 1 1.5-3.3A7 7 0 0 0 12 2z"/></svg>,
  streamdeck: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></svg>
};

// Groupes ordonnés (utilisés comme clés FR — on lit le label localisé via SECTIONS).
const GROUPS = ['Démarrer', 'Onglets', 'Studio', 'Designer', 'Intégrations', 'Référence'];

// Petit helper : choisit fr/en selon la langue active.
const tr = (obj, lang) => (obj && (obj[lang] || obj.fr)) || '';

export default function HelpPanel() {
  const lang = useLang();
  const [activeId, setActiveId] = useState('overview');
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeId]);

  const active = SECTIONS.find(s => s.id === activeId) || SECTIONS[0];

  return (
    <div className="h-full overflow-hidden bg-ink p-3 flex flex-col gap-3 text-slate-200">

      {/* ─────────── HERO ─────────── */}
      <header className="flex-shrink-0 relative bg-slate-950/60 border border-white/5 rounded-xl px-5 py-4 flex items-stretch gap-5">
        <div className="w-24 h-24 bg-black border border-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-400/80 font-semibold">
              {lang === 'en' ? 'USER·DOCUMENTATION' : 'DOCUMENTATION·UTILISATEUR'}
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/30 via-white/5 to-transparent" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">
            {lang === 'en' ? 'Help' : 'Aide'}
          </h1>
          <p className="text-[11px] text-slate-500 tracking-wide">
            {lang === 'en'
              ? 'User guide for presenters and studio operators.'
              : "Guide d'utilisation pour les présentateurs et les opérateurs du studio."}
          </p>
        </div>

        <div className="flex flex-col justify-center gap-1.5 pl-6 border-l border-white/10 flex-shrink-0">
          <div className="flex items-baseline gap-3 whitespace-nowrap">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold w-16">
              {lang === 'en' ? 'VERSION' : 'VERSION'}
            </span>
            <span className="text-xl font-mono font-bold text-cyan-300 tabular-nums leading-none">v{APP_VERSION}</span>
          </div>
          <div className="flex items-baseline gap-3 whitespace-nowrap">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold w-16">
              {lang === 'en' ? 'SECTIONS' : 'SECTIONS'}
            </span>
            <span className="text-xl font-mono font-bold text-slate-100 tabular-nums leading-none">{SECTIONS.length}</span>
          </div>
        </div>
      </header>

      {/* ─────────── BODY : sidebar nav + content ─────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-3">

        {/* Sidebar : navigation wiki */}
        <nav className="col-span-3 bg-slate-950/40 border border-white/5 rounded-xl flex flex-col min-h-0 overflow-hidden">
          <header className="px-4 py-2.5 border-b border-white/5 flex-shrink-0">
            <h3 className="text-[11px] font-bold text-slate-100 uppercase tracking-[0.18em]">
              {lang === 'en' ? 'Contents' : 'Sommaire'}
            </h3>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto py-2">
            {GROUPS.map(group => {
              const sectionsInGroup = SECTIONS.filter(s => s.group.fr === group);
              if (sectionsInGroup.length === 0) return null;
              const groupLabel = tr(sectionsInGroup[0].group, lang);
              return (
                <div key={group} className="mb-3 last:mb-0">
                  <p className="px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">{groupLabel}</p>
                  {sectionsInGroup.map(s => {
                    const isActive = s.id === activeId;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setActiveId(s.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors border-l-2 ${
                          isActive
                            ? 'bg-blue-500/10 border-blue-400 text-blue-100'
                            : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-800/40 hover:border-slate-600 hover:text-slate-100'
                        }`}
                      >
                        <span className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-300' : 'text-slate-500'}`}>
                          {Icons[s.icon]}
                        </span>
                        <span className="truncate">{tr(s.title, lang)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Content : section sélectionnée */}
        <article ref={contentRef} className="col-span-9 bg-slate-950/40 border border-white/5 rounded-xl flex flex-col min-h-0 overflow-hidden">
          <header className="px-6 py-3 border-b border-white/5 flex items-center gap-3 flex-shrink-0">
            <span className="w-5 h-5 text-slate-400 flex-shrink-0">{Icons[active.icon]}</span>
            <h3 className="text-base font-bold text-slate-100">{tr(active.title, lang)}</h3>
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">— {tr(active.group, lang)}</span>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
            <SectionContent id={activeId} lang={lang} />
          </div>
        </article>
      </div>
    </div>
  );
}

// ── Composants utilitaires de mise en forme ─────────────────────────────────

function H2({ children }) {
  return <h2 className="text-lg font-semibold text-slate-100 mt-6 first:mt-0 mb-2">{children}</h2>;
}
function P({ children }) {
  return <p className="text-sm text-slate-300 leading-relaxed mb-3">{children}</p>;
}
function UL({ children }) {
  return <ul className="text-sm text-slate-300 space-y-1.5 list-disc pl-5 mb-3">{children}</ul>;
}
function OL({ children }) {
  return <ol className="text-sm text-slate-300 space-y-2 list-decimal pl-5 mb-3">{children}</ol>;
}
function Tag({ children, color = 'slate' }) {
  const map = {
    slate: 'bg-slate-700/40 text-slate-200 border-slate-500/30',
    blue:  'bg-blue-500/15 text-blue-200 border-blue-500/30',
    cyan:  'bg-cyan-500/15 text-cyan-200 border-cyan-500/30',
    amber: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    green: 'bg-green-500/15 text-green-200 border-green-500/30',
    red:   'bg-red-500/15 text-red-200 border-red-500/30'
  };
  return <span className={`inline-block text-[11px] font-mono font-medium border rounded px-1.5 py-0.5 ${map[color] || map.slate}`}>{children}</span>;
}
function Note({ children, type = 'info' }) {
  const cfg = {
    info:    { cls: 'bg-blue-500/10 border-blue-500/30 text-blue-100',    label: 'INFO' },
    warn:    { cls: 'bg-amber-500/10 border-amber-500/30 text-amber-100', label: 'À NOTER' },
    danger:  { cls: 'bg-red-500/10 border-red-500/30 text-red-100',       label: 'ATTENTION' }
  }[type];
  return (
    <div className={`border rounded-md px-3 py-2 my-3 text-sm leading-relaxed ${cfg.cls}`}>
      <span className="text-[10px] uppercase tracking-widest font-bold opacity-80 mr-2">{cfg.label}</span>
      {children}
    </div>
  );
}
function KBD({ children }) {
  return <kbd className="inline-block bg-slate-900 border border-white/15 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-200 mx-0.5">{children}</kbd>;
}
function ShortcutRow({ keys, label }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="flex-shrink-0 flex items-center gap-1">{keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-slate-600 text-xs mx-0.5">+</span>}
          <KBD>{k}</KBD>
        </React.Fragment>
      ))}</span>
    </div>
  );
}

// ── Contenu par section ─────────────────────────────────────────────────────

function SectionContent({ id, lang }) {
  // Pour chaque section : on a un composant FR et un composant EN. On route
  // selon la langue. Si une version EN manque, fallback sur FR.
  const isEN = lang === 'en';
  switch (id) {
    case 'overview':   return isEN ? <OverviewContentEN />   : <OverviewContent />;
    case 'quickstart': return isEN ? <QuickstartContentEN /> : <QuickstartContent />;
    case 'control':    return isEN ? <ControlContentEN />    : <ControlContent />;
    case 'design':     return isEN ? <DesignContentEN />     : <DesignContent />;
    case 'calendars':  return isEN ? <CalendarsContentEN />  : <CalendarsContent />;
    case 'settings':   return isEN ? <SettingsContentEN />   : <SettingsContent />;
    case 'wiring':     return isEN ? <WiringContentEN />     : <WiringContent />;
    case 'objects':    return isEN ? <ObjectsContentEN />    : <ObjectsContent />;
    case 'palette':    return isEN ? <PaletteContentEN />    : <PaletteContent />;
    case 'streamdeck': return isEN ? <StreamDeckContentEN /> : <StreamDeckContent />;
    case 'shortcuts':  return isEN ? <ShortcutsContentEN />  : <ShortcutsContent />;
    case 'faq':        return isEN ? <FAQContentEN />        : <FAQContent />;
    default:           return null;
  }
}

function OverviewContent() {
  return (
    <>
      <P><strong className="text-slate-100">OnAir Studio</strong> est un système de timer & display pour les studios radio et TV. Il permet de chronométrer une émission, de la diffuser sur l'écran du studio, de piloter la lampe ON AIR et de composer librement l'apparence du display avec un éditeur visuel.</P>
      <H2>Les 5 onglets</H2>
      <UL>
        <li><Tag color="blue">Contrôle</Tag> — Pilotage du chrono en direct (start/pause/stop, durée, ON AIR).</li>
        <li><Tag color="cyan">Design</Tag> — Édition des templates qui s'affichent sur le display du studio.</li>
        <li><Tag color="green">Calendriers</Tag> — Connexion à Google, Microsoft 365, iCloud pour le widget Planning.</li>
        <li><Tag color="amber">Réglages</Tag> — Identité du studio, fuseau horaire, palette de couleurs, sécurité…</li>
        <li><Tag color="slate">Aide</Tag> — Cette page.</li>
      </UL>
      <H2>L'écran du studio (display)</H2>
      <P>Une URL séparée — <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">/display</code> — affiche le template courant en plein écran. C'est ce que vous voyez projeté ou affiché sur le moniteur du studio. Il bascule automatiquement entre 2 templates selon que le chrono tourne ou est arrêté.</P>
      <Note type="info">Le display peut être ouvert sur autant d'écrans que souhaité (régie, studio, accueil…). Tous les écrans sont synchronisés en temps réel.</Note>
    </>
  );
}

function QuickstartContent() {
  return (
    <>
      <H2>Première utilisation</H2>
      <OL>
        <li>Ouvrez <strong>Réglages</strong> et personnalisez l'identité du studio : nom, langue, fuseau horaire, logo.</li>
        <li>Allez dans <strong>Design</strong> et cliquez sur <strong>Nouveau</strong>. Choisissez un modèle de départ (Vierge, 2 horloges, 3 horloges, Veille).</li>
        <li>Activez le template fraîchement créé pour le <strong>Mode actif</strong> (chrono en cours) et/ou le <strong>Mode veille</strong> (chrono à l'arrêt) — boutons en haut du designer.</li>
        <li>Ouvrez l'écran du studio dans un navigateur sur l'URL <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">/display</code> (plein écran <KBD>F11</KBD>).</li>
        <li>Revenez dans <strong>Contrôle</strong>, choisissez une durée et lancez le chrono. L'écran du studio se met à jour en temps réel.</li>
      </OL>
      <H2>Utilisation au quotidien</H2>
      <UL>
        <li>Le présentateur reste sur l'onglet <strong>Contrôle</strong> pendant l'émission.</li>
        <li>Les modifications dans <strong>Design</strong> sont auto-enregistrées 1 seconde après la dernière action.</li>
        <li>Le bouton <strong>ON AIR</strong> nécessite qu'un relais USB soit branché (sinon il reste désactivé).</li>
      </UL>
    </>
  );
}

function ControlContent() {
  return (
    <>
      <P>Le panneau de contrôle est l'interface principale du présentateur. Il regroupe le chrono, les actions ON AIR et un aperçu live de ce qui s'affiche sur le display du studio.</P>
      <H2>Pilotage du chrono</H2>
      <UL>
        <li>Choisissez une <strong>durée prédéfinie</strong> (12, 26, 52 min…) ou éditez la durée chiffre par chiffre.</li>
        <li><Tag color="green">Démarrer</Tag> lance le compte à rebours.</li>
        <li><Tag color="amber">Pause</Tag> suspend le chrono — le display clignote doucement pour le signaler.</li>
        <li><Tag color="blue">Intermédiaire</Tag> marque la fin d'une partie (lap). Utile pour suivre les temps de chaque séquence.</li>
        <li><Tag color="red">Arrêter</Tag> remet le chrono à zéro. Bouton à double-clic pour éviter l'erreur.</li>
      </UL>
      <H2>ON AIR</H2>
      <P>Active la lampe physique du studio et passe le display en mode "antenne". Quand le chrono est en pause, l'indicateur clignote doucement pour signaler une coupure temporaire sans éteindre la lampe.</P>
      <Note type="warn">Si le bouton ON AIR est grisé, c'est que le relais USB n'est pas détecté. Vérifiez le branchement physique.</Note>
      <H2>Bascule de template</H2>
      <P>Vous pouvez changer à la volée quel template est actif pour le <strong>Mode actif</strong> (chrono en cours) ou le <strong>Mode veille</strong> (chrono à l'arrêt), sans quitter Contrôle. Utile pour basculer entre 2 designs entre 2 émissions.</P>
    </>
  );
}

function DesignContent() {
  return (
    <>
      <P>Le designer est un éditeur visuel drag-and-drop pour composer ce qui s'affiche sur l'écran du studio. Tu peux créer plusieurs templates et choisir lesquels s'affichent selon l'état du chrono.</P>
      <H2>Composer un template</H2>
      <OL>
        <li>Cliquez sur <strong>Nouveau</strong>. Donnez un nom et choisissez un modèle de départ.</li>
        <li>Glissez depuis la <strong>palette d'objets</strong> (gauche) vers le canvas central : horloge analogique, numérique, badge ON AIR, texte, image, vidéo, planning…</li>
        <li>Sélectionnez un objet pour le redimensionner, le déplacer, le faire tourner. L'<strong>inspector</strong> à droite expose toutes les propriétés (couleur, police, comportement…).</li>
        <li>Le format du canvas (16:9, 21:9, 4:3, 1:1, 9:16, 3:4 ou custom) se règle dans l'inspector quand rien n'est sélectionné.</li>
      </OL>
      <H2>Aides à la composition</H2>
      <UL>
        <li><strong>Snap</strong> automatique aux objets adjacents (les guides cyan apparaissent pendant le déplacement).</li>
        <li><strong>Grille</strong> configurable (taille, couleur, opacité) — invisible sur le display final.</li>
        <li><strong>Repères système</strong> : marges 25 px et milieux ¼/½/¾ (toggle dans l'inspector).</li>
        <li><strong>Repères personnels</strong> : glissez depuis les règles pour créer des guides X/Y.</li>
        <li>Les <strong>flèches du clavier</strong> déplacent l'objet sélectionné de 1 px (10 px avec <KBD>Maj</KBD>).</li>
      </UL>
      <H2>Activation</H2>
      <P>Un template ne s'affiche sur le studio que s'il est <strong>activé</strong>. Deux slots indépendants existent — <strong>Mode actif</strong> (chrono en cours) et <strong>Mode veille</strong> (chrono à l'arrêt). Activez un template pour chaque slot via les boutons en haut du designer.</P>
      <Note type="info">Sauvegarde automatique : 1 seconde après la dernière modification, le template est enregistré. <KBD>Ctrl</KBD>+<KBD>Z</KBD> et <KBD>Ctrl</KBD>+<KBD>Maj</KBD>+<KBD>Z</KBD> annulent / rétablissent.</Note>
    </>
  );
}

function CalendarsContent() {
  return (
    <>
      <P>Connectez les calendriers de votre studio pour les afficher dans le widget <strong>Planning</strong> du designer. 3 sources sont supportées :</P>
      <H2>Google Calendar</H2>
      <P>Le studio doit fournir un <strong>Client ID</strong> et un <strong>Client Secret</strong> OAuth (Console Google Cloud). Ils s'enregistrent dans la card "Google Calendar" de l'onglet Calendriers. Une fois configurés, cliquez sur <strong>Connecter</strong> pour autoriser un compte Google et lui donner accès à ses agendas.</P>
      <H2>Microsoft 365 / Outlook</H2>
      <P>Même principe que Google, avec un Client ID + Secret + Tenant inscrits sur Azure AD App Registrations. Permissions API requises : <Tag>Calendars.Read</Tag> <Tag>Calendars.Read.Shared</Tag> <Tag>User.Read</Tag> <Tag>offline_access</Tag>.</P>
      <H2>Apple iCloud</H2>
      <P>Apple n'a pas d'OAuth pour les calendriers. Il faut générer un <strong>mot de passe pour application</strong> sur <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">account.apple.com</code> (Sécurité → Mots de passe pour application), puis cliquer sur <strong>Ajouter Apple</strong> et saisir votre Apple ID + ce mot de passe.</P>
      <Note type="warn">Les credentials OAuth (Google, Microsoft) sont des configurations <em>globales</em> du studio — un installateur les configure une fois. Plusieurs comptes utilisateurs peuvent ensuite se connecter via le bouton <strong>Connecter</strong>.</Note>
      <H2>Utilisation dans Design</H2>
      <UL>
        <li>Ajoutez un widget <strong>Planning</strong> sur votre template.</li>
        <li>Choisissez dans l'inspector quel(s) compte(s) et quel(s) calendrier(s) afficher.</li>
        <li>Filtrez par mot-clé, lieu, organisateur, statut (accepté / décliné…).</li>
        <li>Choisissez l'horizon temporel (aujourd'hui, prochaines 6h, 24h, semaine…).</li>
      </UL>
    </>
  );
}

function SettingsContent() {
  return (
    <>
      <H2>Identité du studio</H2>
      <UL>
        <li>Logo (PNG/JPEG/SVG) — affichable dans les templates via l'objet "Logo".</li>
        <li>Nom du studio — utilisé dans les variables texte (<code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">{'{studioName}'}</code>).</li>
        <li>Langue de l'interface (FR / EN).</li>
      </UL>
      <H2>Heure & NTP</H2>
      <UL>
        <li>Fuseau horaire — change l'heure affichée partout dans l'app et sur le display.</li>
        <li>3 serveurs NTP avec fallback automatique. Le voyant vert indique celui utilisé.</li>
      </UL>
      <H2>Préréglages de durée</H2>
      <P>Les durées affichées comme raccourcis dans Contrôle. Ajoutez-en autant que souhaité ; un bouton <strong>Réinitialiser</strong> remet les valeurs par défaut.</P>
      <H2>Arrêt automatique</H2>
      <P>Cadran circulaire dédié dans Réglages — filet de sécurité qui coupe le chrono et la lampe ON AIR après N minutes de <em>dépassement</em> du temps imparti, si l'opérateur a oublié d'arrêter manuellement.</P>
      <UL>
        <li>Réglez la valeur en glissant le point sur le cadran (de 0 à 180 min).</li>
        <li><strong>0 minute = désactivé</strong> (label OFF au centre du cadran). Dans ce cas vous DEVEZ arrêter le chrono à la main, sinon ON AIR reste allumé jusqu'au prochain arrêt manuel.</li>
        <li>Valeur par défaut : 60 min — convient à la plupart des plateaux radio/TV.</li>
        <li>L'arrêt auto ne se déclenche QU'APRÈS dépassement (chrono passé en négatif), pas pendant un chrono normal.</li>
      </UL>
      <H2>Palette de couleurs</H2>
      <P>Une palette globale partagée par tous les pickers du designer. Voir la section <strong>Designer → Palette de couleurs</strong>.</P>
      <H2>Sécurité</H2>
      <P>Mot de passe administrateur — protège l'accès aux onglets Design / Calendriers / Réglages. Modifiable ici. Une fois changé, l'app demande une nouvelle authentification.</P>
      <H2>Relais ON AIR</H2>
      <P>Choix entre relais USB (par défaut) et Ethernet (en développement). Le statut de connexion s'affiche en live à côté du toggle.</P>
      <H2>Mises à jour</H2>
      <P>L'app vérifie automatiquement la disponibilité d'une nouvelle version. Le bouton <strong>Installer</strong> met à jour OnAir Studio sans perdre les templates ni les réglages.</P>
      <H2>Réinitialisation</H2>
      <P>Trois niveaux d'effacement, du moins au plus destructif :</P>
      <UL>
        <li><Tag>Données</Tag> — Templates utilisateurs + uploads (images, vidéos) + comptes calendriers connectés. Conserve les modèles factory et les credentials OAuth globaux.</li>
        <li><Tag>Réglages par défaut</Tag> — Nom, langue, fuseau, NTP, relais, préréglages, palette. Conserve mot de passe admin et templates.</li>
        <li><Tag color="red">Tout réinitialiser</Tag> — Combine les deux + logo personnalisé + credentials OAuth. Seul le mot de passe admin reste.</li>
      </UL>
    </>
  );
}

function ObjectsContent() {
  return (
    <>
      <P>Glisse-dépose ces objets depuis la palette de gauche vers le canvas du designer. Tous sont entièrement paramétrables via l'inspector.</P>
      <H2>Affichage du temps</H2>
      <UL>
        <li><strong>Horloge analogique</strong> — Cadran avec aiguilles, lit l'heure courante du fuseau studio.</li>
        <li><strong>Horloge numérique</strong> — Lecture digitale (HH:MM:SS), police et couleur libres.</li>
        <li><strong>Date</strong> — Format texte personnalisable (jour, mois, année, jour de la semaine…).</li>
        <li><strong>Chrono</strong> — Temps écoulé / restant du compte à rebours en cours.</li>
        <li><strong>Barre de progression</strong> / <strong>Anneau de progression</strong> — Visualisation graphique du chrono avec seuils colorés.</li>
      </UL>
      <H2>Branding</H2>
      <UL>
        <li><strong>Texte dynamique</strong> — Texte libre avec variables (<code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">{'{studioName}'}</code>, <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">{'{date}'}</code>, etc.).</li>
        <li><strong>Logo</strong> — Affiche le logo du studio uploadé dans Réglages.</li>
        <li><strong>Image</strong> — Choix dans la galerie ou upload direct.</li>
        <li><strong>Forme</strong> — Rectangle, cercle, triangle, étoile (couleur de remplissage + bordure).</li>
      </UL>
      <H2>Diffusion</H2>
      <UL>
        <li><strong>Badge ON AIR</strong> — Allumé / éteint selon l'état ON AIR, animation de clignotement réglable.</li>
        <li><strong>Vidéo</strong> — Lecture YouTube, fichier uploadé, ou flux NDI live.</li>
        <li><strong>Planning</strong> — Liste d'événements depuis les calendriers connectés.</li>
      </UL>
    </>
  );
}

function PaletteContent() {
  return (
    <>
      <P>La palette de couleurs est une <strong>liste partagée</strong> que vous construisez une fois dans Réglages, et qui apparaît dans tous les color pickers du designer. Pratique pour réutiliser la charte graphique du studio sans copier-coller des codes hex.</P>
      <H2>Ajouter / modifier</H2>
      <OL>
        <li>Allez dans <strong>Réglages</strong> → card <strong>Palette de couleurs</strong>.</li>
        <li>Cliquez sur <strong>Ajouter</strong>. Une nouvelle couleur (blanc) apparaît dans la grille.</li>
        <li>Cliquez sur le swatch pour ouvrir le picker : roue HTML, champ hex, slider d'opacité.</li>
        <li>Pour supprimer, ouvrez le picker → bouton <strong>Supprimer cette couleur</strong> en bas du popover.</li>
      </OL>
      <H2>Format & transparence</H2>
      <P>Toutes les couleurs sont stockées en <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">#RRGGBBAA</code> (8 chars), avec une transparence de 0 à 100 %. Le damier sous chaque swatch montre la transparence en un coup d'œil.</P>
      <Note type="info">L'application est livrée avec 5 couleurs par défaut adaptées au broadcast (Blanc, Gris, Noir, Rouge ON AIR, Bleu studio). Vous pouvez tout supprimer / réorganiser / repartir de zéro.</Note>
    </>
  );
}

function ShortcutsContent() {
  return (
    <>
      <P>Liste des raccourcis disponibles dans le designer. Sur Mac, remplacez <KBD>Ctrl</KBD> par <KBD>⌘</KBD>.</P>
      <H2>Édition</H2>
      <div className="bg-black/30 rounded-md px-4 py-2 mb-4">
        <ShortcutRow keys={['Ctrl', 'Z']} label="Annuler" />
        <ShortcutRow keys={['Ctrl', 'Maj', 'Z']} label="Rétablir" />
        <ShortcutRow keys={['Ctrl', 'S']} label="Sauvegarder maintenant (auto-save sinon)" />
        <ShortcutRow keys={['Ctrl', 'D']} label="Dupliquer la sélection" />
        <ShortcutRow keys={['Suppr']} label="Supprimer la sélection" />
        <ShortcutRow keys={['Échap']} label="Désélectionner / fermer un popover" />
      </div>
      <H2>Déplacement</H2>
      <div className="bg-black/30 rounded-md px-4 py-2 mb-4">
        <ShortcutRow keys={['↑', '↓', '←', '→']} label="Déplacer de 1 px" />
        <ShortcutRow keys={['Maj', '+ flèches']} label="Déplacer de 10 px" />
      </div>
      <H2>Display</H2>
      <div className="bg-black/30 rounded-md px-4 py-2">
        <ShortcutRow keys={['F11']} label="Plein écran (navigateur)" />
        <ShortcutRow keys={['F5']} label="Recharger l'écran du studio" />
      </div>
    </>
  );
}

function FAQContent() {
  return (
    <>
      <H2>Le bouton ON AIR est grisé</H2>
      <P>Le relais USB n'est pas détecté. Vérifiez qu'il est bien branché et que le pilote est reconnu. Le statut s'affiche dans <strong>Réglages → Relais</strong>.</P>

      <H2>L'écran du studio reste noir</H2>
      <P>Aucun template n'est activé pour le mode courant (<strong>Mode actif</strong> ou <strong>Mode veille</strong>). Allez dans <strong>Design</strong>, sélectionnez un template puis cliquez sur <strong>Activer</strong> en haut du designer.</P>

      <H2>Le chrono dérive de quelques secondes</H2>
      <P>Vérifiez la synchronisation NTP dans <strong>Réglages → Heure</strong>. Le voyant doit être vert (LOCK). S'il est ambré, changez le serveur NTP principal — souvent le réseau du studio bloque <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">pool.ntp.org</code>.</P>

      <H2>Mon calendrier connecté n'affiche pas les bons événements</H2>
      <P>Dans Calendriers, cliquez sur <strong>↻</strong> à côté du compte concerné pour forcer la resynchronisation. Si le problème persiste, déconnectez puis reconnectez le compte.</P>

      <H2>J'ai supprimé un template par erreur</H2>
      <P>Pas de récupération automatique — la suppression est définitive. La meilleure pratique : <strong>Exporter en JSON</strong> les templates importants depuis le toolbar du designer pour avoir une sauvegarde locale.</P>

      <H2>Comment partager un template avec un autre studio ?</H2>
      <OL>
        <li>Dans Design, ouvrez le template à partager.</li>
        <li>Cliquez sur <strong>Exporter</strong> dans le toolbar — un fichier <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">.json</code> est téléchargé.</li>
        <li>Sur l'autre studio, cliquez sur <strong>Importer</strong> et sélectionnez le JSON.</li>
      </OL>

      <H2>L'auto-save indique « Erreur »</H2>
      <P>Le serveur n'est plus joignable ou la session admin a expiré. Rechargez la page — l'app demandera une nouvelle authentification si nécessaire. Les modifications non sauvegardées seront perdues si la session est invalide.</P>

      <H2>Le widget Vidéo NDI ne trouve aucune source</H2>
      <P>Vérifiez qu'au moins un encodeur NDI est actif sur le LAN. La détection se fait par mDNS — votre routeur ne doit pas filtrer le multicast. Si rien n'apparaît dans la liste, redémarrez l'encodeur NDI source.</P>
    </>
  );
}

function WiringContent() {
  return (
    <>
      <P>Le studio dispose d'un <strong>relais USB</strong> qui pilote la <strong>lampe ON AIR</strong> (rouge) et — selon le câblage — un <strong>témoin de veille / studio actif</strong> (vert). Ces voyants signalent à toute l'équipe l'état du studio en temps réel.</P>

      <H2>Comportement des voyants</H2>
      <UL>
        <li><Tag color="red">Lampe rouge</Tag> — allumée fixe quand <strong>ON AIR</strong> est activé. Clignote doucement si le chrono est mis en pause.</li>
        <li><Tag color="green">Témoin vert</Tag> (optionnel selon installation) — allumé fixe pour signaler que le studio est <em>prêt</em> ou <em>en veille active</em>, hors antenne.</li>
        <li>Les deux voyants sont <strong>mutuellement exclusifs</strong> — un seul est allumé à la fois.</li>
      </UL>

      <H2>Activation depuis l'app</H2>
      <UL>
        <li>Bouton <strong>ON AIR</strong> dans l'onglet Contrôle — allume / éteint la lampe rouge.</li>
        <li>Le voyant vert s'allume automatiquement quand le chrono est arrêté ou en mode veille (pas d'action requise).</li>
        <li>Pendant une pause du chrono, la lampe rouge reste allumée mais clignote — signal visuel "en pause antenne, on revient".</li>
      </UL>

      <H2>Vérifier l'état du relais</H2>
      <P>Va dans <strong>Réglages → Relais</strong>. Tu y vois le statut en direct :</P>
      <UL>
        <li><Tag color="green">Connecté</Tag> — le relais USB est détecté et opérationnel.</li>
        <li><Tag color="amber">Déconnecté</Tag> — câble USB débranché ou pilote non chargé. Le bouton ON AIR sera grisé tant que ce statut persiste.</li>
      </UL>

      <H2>Schémas de câblage</H2>
      <P>Selon la configuration du studio, le relais peut être câblé de 3 manières différentes. Voici les schémas de référence pour identifier la vôtre et diagnostiquer un problème en local.</P>

      <Note type="warn">Le câblage <strong>230 V</strong> (côté primaire de l'alim) doit toujours être réalisé hors tension par une personne qualifiée. Le côté <strong>24 V</strong> (basse tension) est sans danger pour des manipulations courantes.</Note>

      <H2>Configuration 1 — Lampe simple (1 canal, 1 LED rouge)</H2>
      <P>Configuration de base : un seul canal du relais commute le +24 V vers une lampe rouge. La lampe s'allume uniquement quand ON AIR est actif.</P>
      <WiringDiagramSimple />

      <H2>Configuration 2 — Bicolore (1 canal, NO + NC, rouge / vert)</H2>
      <P>Une seule carte 1-canal qui pilote 2 lampes. Le contact <strong>NC</strong> alimente le vert (par défaut, idle), le contact <strong>NO</strong> alimente le rouge (en antenne). Inversion automatique grâce à l'architecture du relais.</P>
      <WiringDiagramBicolor />

      <H2>Configuration 3 — Deux canaux indépendants</H2>
      <P>Carte relais 2-canaux : canal 1 pilote l'antenne (rouge), canal 2 pilote le studio actif (vert). Plus flexible — chaque voyant peut être contrôlé indépendamment.</P>
      <WiringDiagramTwoChannel />

      <Note type="info">Si quelque chose ne s'allume plus alors que ça marchait, vérifie d'abord le statut dans <strong>Réglages → Relais</strong> (logiciel) puis les LEDs internes du boîtier (matériel). Pour toute intervention sur le câblage, contacte la personne qui a installé le système.</Note>
    </>
  );
}

// ── Schémas SVG du câblage — référence visuelle pour les utilisateurs ─────
function WiringDiagramSimple() {
  return (
    <div className="bg-slate-950/60 border border-white/5 rounded-lg p-4 my-3 overflow-x-auto">
      <svg viewBox="0 0 720 320" className="w-full max-w-3xl mx-auto" style={{ minWidth: 540 }}>
        {/* OnAir Studio — alimentation USB 5V */}
        <rect x="10" y="20" width="130" height="60" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5"/>
        <text x="75" y="46" fill="#cbd5e1" fontSize="11" textAnchor="middle" fontWeight="600">OnAir Studio</text>
        <text x="75" y="62" fill="#64748b" fontSize="9" textAnchor="middle">port USB</text>

        {/* Câble USB 5V vers carte */}
        <line x1="140" y1="50" x2="180" y2="50" stroke="#a855f7" strokeWidth="2"/>
        <text x="160" y="42" fill="#a855f7" fontSize="9" textAnchor="middle" fontWeight="600">USB 5V</text>

        {/* Carte relais */}
        <rect x="180" y="20" width="180" height="100" rx="6" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="270" y="40" fill="#60a5fa" fontSize="11" textAnchor="middle" fontWeight="600">Carte relais USB</text>
        <text x="270" y="54" fill="#64748b" fontSize="9" textAnchor="middle">logique 5 V — 1 canal</text>
        <circle cx="200" cy="85" r="4" fill="#3b82f6"/>
        <text x="200" y="108" fill="#cbd5e1" fontSize="9" textAnchor="middle">COM</text>
        <circle cx="270" cy="85" r="4" fill="#22c55e"/>
        <text x="270" y="108" fill="#cbd5e1" fontSize="9" textAnchor="middle">NO</text>
        <circle cx="340" cy="85" r="4" fill="#64748b"/>
        <text x="340" y="108" fill="#475569" fontSize="9" textAnchor="middle">NC</text>

        {/* Alim 230V → 24V */}
        <rect x="10" y="180" width="180" height="80" rx="6" fill="#1f2937" stroke="#dc2626" strokeWidth="1.5"/>
        <text x="100" y="205" fill="#fca5a5" fontSize="11" textAnchor="middle" fontWeight="600">Alim externe</text>
        <text x="100" y="222" fill="#cbd5e1" fontSize="10" textAnchor="middle" fontWeight="600">230 V → 24 V</text>
        <text x="100" y="246" fill="#64748b" fontSize="9" textAnchor="middle">DIN / bloc rail</text>
        <circle cx="170" cy="210" r="3" fill="#fbbf24"/>
        <text x="183" y="213" fill="#fbbf24" fontSize="9" fontWeight="700">+24 V</text>
        <circle cx="170" cy="240" r="3" fill="#94a3b8"/>
        <text x="183" y="243" fill="#94a3b8" fontSize="9" fontWeight="700">0 V</text>
        <text x="100" y="178" fill="#dc2626" fontSize="9" textAnchor="middle">⚡ 230 V (côté primaire — qualifié)</text>

        {/* +24V vers COM */}
        <line x1="190" y1="210" x2="200" y2="210" stroke="#fbbf24" strokeWidth="2"/>
        <line x1="200" y1="210" x2="200" y2="85" stroke="#fbbf24" strokeWidth="2"/>
        <text x="155" y="160" fill="#fbbf24" fontSize="9" fontWeight="600">+24 V</text>

        {/* NO → Lampe */}
        <line x1="270" y1="85" x2="270" y2="290" stroke="#fbbf24" strokeWidth="2" strokeDasharray="3,3"/>
        <line x1="270" y1="290" x2="540" y2="290" stroke="#fbbf24" strokeWidth="2" strokeDasharray="3,3"/>
        <text x="380" y="285" fill="#fbbf24" fontSize="9" fontWeight="600">+24 V (commuté par le relais)</text>

        {/* Lampe */}
        <circle cx="600" cy="280" r="26" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2"/>
        <text x="600" y="278" fill="#fef2f2" fontSize="9" textAnchor="middle" fontWeight="700">ON</text>
        <text x="600" y="290" fill="#fef2f2" fontSize="9" textAnchor="middle" fontWeight="700">AIR</text>
        <text x="600" y="320" fill="#94a3b8" fontSize="9" textAnchor="middle">LED 24 V</text>

        {/* Retour 0V */}
        <line x1="626" y1="280" x2="660" y2="280" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="660" y1="280" x2="660" y2="240" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="660" y1="240" x2="190" y2="240" stroke="#94a3b8" strokeWidth="2"/>
        <text x="430" y="234" fill="#94a3b8" fontSize="9" fontWeight="600">0 V (retour à la masse de l'alim)</text>
      </svg>
    </div>
  );
}

function WiringDiagramBicolor() {
  return (
    <div className="bg-slate-950/60 border border-white/5 rounded-lg p-4 my-3 overflow-x-auto">
      <svg viewBox="0 0 720 360" className="w-full max-w-3xl mx-auto" style={{ minWidth: 540 }}>
        {/* Studio + USB */}
        <rect x="10" y="20" width="130" height="60" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5"/>
        <text x="75" y="46" fill="#cbd5e1" fontSize="11" textAnchor="middle" fontWeight="600">OnAir Studio</text>
        <text x="75" y="62" fill="#64748b" fontSize="9" textAnchor="middle">port USB</text>
        <line x1="140" y1="50" x2="180" y2="50" stroke="#a855f7" strokeWidth="2"/>
        <text x="160" y="42" fill="#a855f7" fontSize="9" textAnchor="middle" fontWeight="600">USB 5V</text>

        {/* Carte relais */}
        <rect x="180" y="20" width="180" height="100" rx="6" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="270" y="40" fill="#60a5fa" fontSize="11" textAnchor="middle" fontWeight="600">Carte relais USB</text>
        <text x="270" y="54" fill="#64748b" fontSize="9" textAnchor="middle">logique 5 V — 1 canal</text>
        <circle cx="200" cy="85" r="4" fill="#3b82f6"/>
        <text x="200" y="108" fill="#cbd5e1" fontSize="9" textAnchor="middle">COM</text>
        <circle cx="270" cy="85" r="4" fill="#22c55e"/>
        <text x="270" y="108" fill="#cbd5e1" fontSize="9" textAnchor="middle">NO</text>
        <circle cx="340" cy="85" r="4" fill="#dc2626"/>
        <text x="340" y="108" fill="#cbd5e1" fontSize="9" textAnchor="middle">NC</text>

        {/* Alim 230V → 24V */}
        <rect x="10" y="180" width="180" height="80" rx="6" fill="#1f2937" stroke="#dc2626" strokeWidth="1.5"/>
        <text x="100" y="205" fill="#fca5a5" fontSize="11" textAnchor="middle" fontWeight="600">Alim externe</text>
        <text x="100" y="222" fill="#cbd5e1" fontSize="10" textAnchor="middle" fontWeight="600">230 V → 24 V</text>
        <text x="100" y="246" fill="#64748b" fontSize="9" textAnchor="middle">DIN / bloc rail</text>
        <circle cx="170" cy="210" r="3" fill="#fbbf24"/>
        <text x="183" y="213" fill="#fbbf24" fontSize="9" fontWeight="700">+24 V</text>
        <circle cx="170" cy="240" r="3" fill="#94a3b8"/>
        <text x="183" y="243" fill="#94a3b8" fontSize="9" fontWeight="700">0 V</text>
        <text x="100" y="178" fill="#dc2626" fontSize="9" textAnchor="middle">⚡ 230 V (côté primaire — qualifié)</text>

        {/* +24V → COM */}
        <line x1="190" y1="210" x2="200" y2="210" stroke="#fbbf24" strokeWidth="2"/>
        <line x1="200" y1="210" x2="200" y2="85" stroke="#fbbf24" strokeWidth="2"/>
        <text x="155" y="160" fill="#fbbf24" fontSize="9" fontWeight="600">+24 V</text>

        {/* NC → vert (idle) */}
        <line x1="340" y1="85" x2="340" y2="290" stroke="#22c55e" strokeWidth="2" strokeDasharray="3,3"/>
        <line x1="340" y1="290" x2="540" y2="290" stroke="#22c55e" strokeWidth="2" strokeDasharray="3,3"/>
        <text x="370" y="285" fill="#22c55e" fontSize="9" fontWeight="600">+24 V vers VERT (idle)</text>

        {/* NO → rouge (antenne) */}
        <line x1="270" y1="85" x2="270" y2="320" stroke="#dc2626" strokeWidth="2" strokeDasharray="3,3"/>
        <line x1="270" y1="320" x2="540" y2="320" stroke="#dc2626" strokeWidth="2" strokeDasharray="3,3"/>
        <text x="320" y="315" fill="#dc2626" fontSize="9" fontWeight="600">+24 V vers ROUGE (antenne)</text>

        {/* Lampes */}
        <circle cx="600" cy="280" r="20" fill="#22c55e" stroke="#14532d" strokeWidth="2"/>
        <text x="600" y="284" fill="#052e16" fontSize="9" textAnchor="middle" fontWeight="700">VERT</text>
        <circle cx="600" cy="320" r="20" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2"/>
        <text x="600" y="324" fill="#fef2f2" fontSize="9" textAnchor="middle" fontWeight="700">ROUGE</text>

        {/* Retour 0V commun */}
        <line x1="620" y1="280" x2="650" y2="280" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="620" y1="320" x2="650" y2="320" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="650" y1="280" x2="650" y2="240" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="650" y1="320" x2="650" y2="260" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="650" y1="240" x2="190" y2="240" stroke="#94a3b8" strokeWidth="2"/>
        <text x="425" y="234" fill="#94a3b8" fontSize="9" fontWeight="600">0 V (masse partagée — retour à l'alim)</text>

        {/* Légende état */}
        <g transform="translate(380, 40)">
          <text x="0" y="0" fill="#22c55e" fontSize="9" fontWeight="600">● relais OFF → vert allumé</text>
          <text x="0" y="14" fill="#dc2626" fontSize="9" fontWeight="600">● relais ON → rouge allumé</text>
        </g>
      </svg>
    </div>
  );
}

function WiringDiagramTwoChannel() {
  return (
    <div className="bg-slate-950/60 border border-white/5 rounded-lg p-4 my-3 overflow-x-auto">
      <svg viewBox="0 0 720 360" className="w-full max-w-3xl mx-auto" style={{ minWidth: 540 }}>
        {/* Studio + USB */}
        <rect x="10" y="20" width="130" height="60" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5"/>
        <text x="75" y="46" fill="#cbd5e1" fontSize="11" textAnchor="middle" fontWeight="600">OnAir Studio</text>
        <text x="75" y="62" fill="#64748b" fontSize="9" textAnchor="middle">port USB</text>
        <line x1="140" y1="50" x2="180" y2="50" stroke="#a855f7" strokeWidth="2"/>
        <text x="160" y="42" fill="#a855f7" fontSize="9" textAnchor="middle" fontWeight="600">USB 5V</text>

        {/* Carte 2 canaux */}
        <rect x="180" y="20" width="200" height="160" rx="6" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="280" y="40" fill="#60a5fa" fontSize="11" textAnchor="middle" fontWeight="600">Carte relais USB</text>
        <text x="280" y="54" fill="#64748b" fontSize="9" textAnchor="middle">logique 5 V — 2 canaux</text>

        <text x="280" y="76" fill="#dc2626" fontSize="9" textAnchor="middle" fontWeight="700">CANAL 1 — Antenne</text>
        <circle cx="220" cy="96" r="4" fill="#3b82f6"/>
        <text x="220" y="110" fill="#cbd5e1" fontSize="8" textAnchor="middle">COM1</text>
        <circle cx="280" cy="96" r="4" fill="#22c55e"/>
        <text x="280" y="110" fill="#cbd5e1" fontSize="8" textAnchor="middle">NO1</text>

        <text x="280" y="135" fill="#22c55e" fontSize="9" textAnchor="middle" fontWeight="700">CANAL 2 — Studio actif</text>
        <circle cx="220" cy="155" r="4" fill="#3b82f6"/>
        <text x="220" y="169" fill="#cbd5e1" fontSize="8" textAnchor="middle">COM2</text>
        <circle cx="280" cy="155" r="4" fill="#22c55e"/>
        <text x="280" y="169" fill="#cbd5e1" fontSize="8" textAnchor="middle">NO2</text>

        {/* Alim 230V → 24V */}
        <rect x="10" y="220" width="180" height="80" rx="6" fill="#1f2937" stroke="#dc2626" strokeWidth="1.5"/>
        <text x="100" y="245" fill="#fca5a5" fontSize="11" textAnchor="middle" fontWeight="600">Alim externe</text>
        <text x="100" y="262" fill="#cbd5e1" fontSize="10" textAnchor="middle" fontWeight="600">230 V → 24 V</text>
        <text x="100" y="286" fill="#64748b" fontSize="9" textAnchor="middle">prévoir l'ampérage</text>
        <circle cx="170" cy="250" r="3" fill="#fbbf24"/>
        <text x="183" y="253" fill="#fbbf24" fontSize="9" fontWeight="700">+24 V</text>
        <circle cx="170" cy="280" r="3" fill="#94a3b8"/>
        <text x="183" y="283" fill="#94a3b8" fontSize="9" fontWeight="700">0 V</text>
        <text x="100" y="218" fill="#dc2626" fontSize="9" textAnchor="middle">⚡ 230 V (côté primaire — qualifié)</text>

        {/* +24V → COM1 + COM2 (commun) */}
        <line x1="190" y1="250" x2="200" y2="250" stroke="#fbbf24" strokeWidth="2"/>
        <line x1="200" y1="250" x2="200" y2="96" stroke="#fbbf24" strokeWidth="2"/>
        <line x1="200" y1="155" x2="220" y2="155" stroke="#fbbf24" strokeWidth="2"/>
        <line x1="200" y1="96" x2="220" y2="96" stroke="#fbbf24" strokeWidth="2"/>
        <text x="155" y="195" fill="#fbbf24" fontSize="9" fontWeight="600">+24 V (COM1 + COM2)</text>

        {/* NO1 → rouge */}
        <line x1="280" y1="96" x2="540" y2="96" stroke="#dc2626" strokeWidth="2" strokeDasharray="3,3"/>
        <circle cx="600" cy="96" r="22" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2"/>
        <text x="600" y="100" fill="#fef2f2" fontSize="9" textAnchor="middle" fontWeight="700">ROUGE</text>

        {/* NO2 → vert */}
        <line x1="280" y1="155" x2="540" y2="155" stroke="#22c55e" strokeWidth="2" strokeDasharray="3,3"/>
        <circle cx="600" cy="155" r="22" fill="#22c55e" stroke="#14532d" strokeWidth="2"/>
        <text x="600" y="159" fill="#052e16" fontSize="9" textAnchor="middle" fontWeight="700">VERT</text>

        {/* Retour 0V commun */}
        <line x1="622" y1="96" x2="660" y2="96" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="622" y1="155" x2="660" y2="155" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="660" y1="96" x2="660" y2="280" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="660" y1="280" x2="190" y2="280" stroke="#94a3b8" strokeWidth="2"/>
        <text x="430" y="274" fill="#94a3b8" fontSize="9" fontWeight="600">0 V (masse commune — retour à l'alim)</text>
      </svg>
    </div>
  );
}

function StreamDeckContent() {
  return (
    <>
      <P>OnAir Studio peut être piloté depuis un <strong>Stream Deck Elgato</strong> ou tout contrôleur compatible <strong>Bitfocus Companion</strong>. Idéal pour avoir des boutons physiques bien visibles dans la régie : Démarrer, Pause, ON AIR, presets de durée…</P>

      <H2>Méthode 1 — Companion (recommandée)</H2>
      <OL>
        <li>Installe <strong>Bitfocus Companion</strong> sur la machine connectée au Stream Deck.</li>
        <li>Ajoute une connexion <strong>Generic HTTP</strong> dans Companion (Connexions → +).</li>
        <li>Pour chaque bouton, configure une action <strong>HTTP Request</strong> qui appelle l'URL OnAir Studio correspondante (voir la liste ci-dessous).</li>
        <li>Optionnel : configure aussi une <strong>HTTP Request</strong> en <em>feedback</em> sur l'endpoint d'état pour allumer le bouton du Stream Deck quand l'action est active (ex: ON AIR allumé en rouge).</li>
      </OL>

      <H2>Méthode 2 — Stream Deck natif</H2>
      <P>Sans Companion, utilise le plugin <strong>API Ninja</strong> ou <strong>Web Requests</strong> du Stream Deck Store. Configure chaque bouton pour appeler la même URL en <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">POST</code>.</P>

      <H2>Boutons utiles</H2>
      <P>Toutes les actions sont des <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">POST</code> sur l'IP/port du studio (par défaut <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">:3333</code>) :</P>

      <div className="bg-black/30 rounded-md px-4 py-3 mb-4 space-y-2">
        <CommandRow label="Démarrer le chrono" cmd="POST /api/timer/start" />
        <CommandRow label="Mettre en pause" cmd="POST /api/timer/pause" />
        <CommandRow label="Reprendre" cmd="POST /api/timer/resume" />
        <CommandRow label="Arrêter" cmd="POST /api/timer/stop" />
        <CommandRow label="Marquer un intermédiaire" cmd="POST /api/timer/lap" />
        <CommandRow label="ON AIR — activer" cmd="POST /api/onair/on" />
        <CommandRow label="ON AIR — éteindre" cmd="POST /api/onair/off" />
        <CommandRow label="ON AIR — toggle" cmd="POST /api/onair/toggle" />
        <CommandRow label="Définir une durée (ex: 26 min)" cmd='POST /api/timer/duration?value=00:26:00' />
      </div>

      <H2>Obtenir le bon URL de base</H2>
      <P>L'URL exacte à utiliser dans Companion est celle visible dans la barre du navigateur lors de l'accès au panneau de contrôle, suivie de l'endpoint. Exemple : si vous accédez à OnAir Studio via <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">http://192.168.1.42:3333/control</code>, l'URL pour démarrer le chrono est <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">http://192.168.1.42:3333/api/timer/start</code>.</P>

      <Note type="warn">Selon la config, l'API peut exiger le mot de passe admin. Dans Companion, ajoutez un header <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">X-Admin-Password: votre-mot-de-passe</code> sur les requêtes — voir avec l'installateur.</Note>

      <H2>Exemples de presets</H2>
      <UL>
        <li><strong>Bouton "26 MIN"</strong> — appelle <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">POST /api/timer/duration?value=00:26:00</code> puis <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">POST /api/timer/start</code> en chaîne.</li>
        <li><strong>Bouton "ON AIR" rouge clignotant</strong> — toggle ON AIR + lit l'état dans Companion pour faire clignoter physiquement le bouton Stream Deck pendant l'antenne.</li>
        <li><strong>Bouton panique "STOP"</strong> — combine <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">/api/onair/off</code> + <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">/api/timer/stop</code> pour tout couper d'un coup.</li>
      </UL>
    </>
  );
}

// Ligne d'une commande HTTP — utilisée dans Stream Deck pour aligner label + URL.
function CommandRow({ label, cmd }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-300">{label}</span>
      <code className="text-[11px] font-mono text-cyan-300 bg-black/60 border border-white/5 rounded px-2 py-0.5 select-all flex-shrink-0">{cmd}</code>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ── Versions anglaises de chaque section — affichées quand lang === 'en'.
// ─────────────────────────────────────────────────────────────────────────

function OverviewContentEN() {
  return (
    <>
      <P><strong className="text-slate-100">OnAir Studio</strong> is a timer & display system for radio and TV studios. It clocks shows, projects them on the studio screen, drives the ON AIR lamp, and lets you compose the display freely with a visual editor.</P>
      <H2>The 5 tabs</H2>
      <UL>
        <li><Tag color="blue">Control</Tag> — Live timer driving (start/pause/stop, duration, ON AIR).</li>
        <li><Tag color="cyan">Design</Tag> — Edit the templates shown on the studio display.</li>
        <li><Tag color="green">Calendars</Tag> — Connect to Google, Microsoft 365, iCloud for the Planning widget.</li>
        <li><Tag color="amber">Settings</Tag> — Studio identity, timezone, color palette, security…</li>
        <li><Tag color="slate">Help</Tag> — This page.</li>
      </UL>
      <H2>The studio display</H2>
      <P>A separate URL — <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">/display</code> — shows the current template fullscreen. This is what gets projected on the studio monitor. It auto-switches between 2 templates depending on whether the timer is running or stopped.</P>
      <Note type="info">The display can be opened on any number of screens (control room, studio, lobby…). All screens are synced in real time.</Note>
    </>
  );
}

function QuickstartContentEN() {
  return (
    <>
      <H2>First-time setup</H2>
      <OL>
        <li>Open <strong>Settings</strong> and customize the studio identity: name, language, timezone, logo.</li>
        <li>Go to <strong>Design</strong> and click <strong>New</strong>. Pick a starter (Blank, 2 clocks, 3 clocks, Idle).</li>
        <li>Activate the freshly created template for the <strong>Active mode</strong> (timer running) and/or the <strong>Idle mode</strong> (timer stopped) — buttons at the top of the designer.</li>
        <li>Open the studio display in a browser at the URL <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">/display</code> (fullscreen <KBD>F11</KBD>).</li>
        <li>Back in <strong>Control</strong>, pick a duration and start the timer. The studio display updates live.</li>
      </OL>
      <H2>Daily use</H2>
      <UL>
        <li>The presenter stays on the <strong>Control</strong> tab during the show.</li>
        <li>Changes in <strong>Design</strong> are auto-saved 1 second after the last action.</li>
        <li>The <strong>ON AIR</strong> button requires a USB relay (otherwise it stays disabled).</li>
      </UL>
    </>
  );
}

function ControlContentEN() {
  return (
    <>
      <P>The control panel is the presenter's main interface. It groups the timer, ON AIR actions, and a live preview of what's shown on the studio display.</P>
      <H2>Driving the timer</H2>
      <UL>
        <li>Pick a <strong>preset duration</strong> (12, 26, 52 min…) or edit the duration digit by digit.</li>
        <li><Tag color="green">Start</Tag> launches the countdown.</li>
        <li><Tag color="amber">Pause</Tag> suspends the timer — the display gently blinks to signal it.</li>
        <li><Tag color="blue">Lap</Tag> marks the end of a section. Useful to track each segment's time.</li>
        <li><Tag color="red">Stop</Tag> resets the timer. Double-click button to prevent accidents.</li>
      </UL>
      <H2>ON AIR</H2>
      <P>Activates the studio's physical lamp and switches the display to "on air" mode. When the timer is paused, the indicator gently blinks to signal a temporary cut without turning the lamp off.</P>
      <Note type="warn">If the ON AIR button is greyed out, the USB relay is not detected. Check the physical connection.</Note>
      <H2>Template switching</H2>
      <P>You can change which template is active for the <strong>Active mode</strong> (timer running) or the <strong>Idle mode</strong> (timer stopped) on the fly, without leaving Control. Useful to switch between two designs between shows.</P>
    </>
  );
}

function DesignContentEN() {
  return (
    <>
      <P>The designer is a drag-and-drop visual editor for composing what's shown on the studio display. You can create multiple templates and pick which ones show up depending on the timer state.</P>
      <H2>Composing a template</H2>
      <OL>
        <li>Click <strong>New</strong>. Give it a name and pick a starter template.</li>
        <li>Drag from the <strong>object palette</strong> (left) onto the central canvas: analog/digital clock, ON AIR badge, text, image, video, planning…</li>
        <li>Select an object to resize, move, or rotate it. The <strong>inspector</strong> on the right exposes every property (color, font, behavior…).</li>
        <li>Canvas format (16:9, 21:9, 4:3, 1:1, 9:16, 3:4 or custom) is set in the inspector when nothing is selected.</li>
      </OL>
      <H2>Composition aids</H2>
      <UL>
        <li>Automatic <strong>snap</strong> to adjacent objects (cyan guides appear during drag).</li>
        <li>Configurable <strong>grid</strong> (size, color, opacity) — invisible on the final display.</li>
        <li><strong>System guides</strong>: 25 px margins and ¼/½/¾ midlines (toggle in the inspector).</li>
        <li><strong>Personal guides</strong>: drag from the rulers to create X/Y guides.</li>
        <li>Use <strong>arrow keys</strong> to move the selected object by 1 px (10 px with <KBD>Shift</KBD>).</li>
      </UL>
      <H2>Activation</H2>
      <P>A template only shows on the studio when it's <strong>activated</strong>. Two independent slots exist — <strong>Active mode</strong> (timer running) and <strong>Idle mode</strong> (timer stopped). Activate a template for each slot via the buttons at the top of the designer.</P>
      <Note type="info">Auto-save: 1 second after the last change, the template is saved. <KBD>Ctrl</KBD>+<KBD>Z</KBD> and <KBD>Ctrl</KBD>+<KBD>Shift</KBD>+<KBD>Z</KBD> undo/redo.</Note>
    </>
  );
}

function CalendarsContentEN() {
  return (
    <>
      <P>Connect your studio's calendars to display them in the designer's <strong>Planning</strong> widget. 3 sources are supported:</P>
      <H2>Google Calendar</H2>
      <P>The studio must provide an OAuth <strong>Client ID</strong> and <strong>Client Secret</strong> (Google Cloud Console). They're saved in the "Google Calendar" card of the Calendars tab. Once configured, click <strong>Connect</strong> to authorize a Google account and grant access to its calendars.</P>
      <H2>Microsoft 365 / Outlook</H2>
      <P>Same as Google, with a Client ID + Secret + Tenant registered on Azure AD App Registrations. Required API permissions: <Tag>Calendars.Read</Tag> <Tag>Calendars.Read.Shared</Tag> <Tag>User.Read</Tag> <Tag>offline_access</Tag>.</P>
      <H2>Apple iCloud</H2>
      <P>Apple does not offer OAuth for calendars. You need to generate an <strong>app-specific password</strong> on <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">account.apple.com</code> (Security → App-Specific Passwords), then click <strong>Add Apple</strong> and enter your Apple ID + this password.</P>
      <Note type="warn">OAuth credentials (Google, Microsoft) are <em>global</em> studio configuration — an installer sets them once. Multiple user accounts can then connect via the <strong>Connect</strong> button.</Note>
      <H2>Use in Design</H2>
      <UL>
        <li>Add a <strong>Planning</strong> widget to the template.</li>
        <li>In the inspector, pick which account(s) and calendar(s) to show.</li>
        <li>Filter by keyword, location, organizer, status (accepted / declined…).</li>
        <li>Pick the time horizon (today, next 6h, 24h, week…).</li>
      </UL>
    </>
  );
}

function SettingsContentEN() {
  return (
    <>
      <H2>Studio identity</H2>
      <UL>
        <li>Logo (PNG/JPEG/SVG) — usable in templates via the "Logo" object.</li>
        <li>Studio name — used in text variables (<code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">{'{studioName}'}</code>).</li>
        <li>Interface language (FR / EN).</li>
      </UL>
      <H2>Time & NTP</H2>
      <UL>
        <li>Timezone — changes the time shown everywhere in the app and on the display.</li>
        <li>3 NTP servers with automatic fallback. The green dot indicates the active one.</li>
      </UL>
      <H2>Duration presets</H2>
      <P>The durations shown as shortcuts in Control. Add as many as needed; a <strong>Reset</strong> button restores the defaults.</P>
      <H2>Auto-stop</H2>
      <P>Dedicated circular dial in Settings — safety net that stops the timer and turns off the ON AIR lamp after N minutes of <em>overrun</em>, if the operator forgot to stop manually.</P>
      <UL>
        <li>Adjust by dragging the point on the dial (0 to 180 min).</li>
        <li><strong>0 minutes = disabled</strong> (OFF label in the dial center). In that case you MUST stop the timer manually, otherwise ON AIR stays lit until the next manual stop.</li>
        <li>Default value: 60 min — suitable for most radio/TV setups.</li>
        <li>Auto-stop only triggers AFTER overrun (timer gone negative), not during a normal countdown.</li>
      </UL>
      <H2>Color palette</H2>
      <P>A global palette shared by every color picker in the designer. See the <strong>Designer → Color palette</strong> section.</P>
      <H2>Security</H2>
      <P>Admin password — protects access to the Design / Calendars / Settings tabs. Editable here. Once changed, the app prompts for a new authentication.</P>
      <H2>ON AIR relay</H2>
      <P>Choose between USB relay (default) and Ethernet (in development). The connection status is displayed live next to the toggle.</P>
      <H2>Updates</H2>
      <P>The app automatically checks for new versions. The <strong>Install</strong> button updates OnAir Studio without losing templates or settings.</P>
      <H2>Reset</H2>
      <P>Three levels of erasure, from least to most destructive:</P>
      <UL>
        <li><Tag>Data</Tag> — User templates + uploads + connected calendar accounts. Factory templates and global OAuth credentials are kept.</li>
        <li><Tag>Default settings</Tag> — Name, language, timezone, NTP, relay, presets, palette. Admin password and templates are kept.</li>
        <li><Tag color="red">Reset everything</Tag> — Combines both + custom logo + OAuth credentials. Only the admin password remains.</li>
      </UL>
    </>
  );
}

function ObjectsContentEN() {
  return (
    <>
      <P>Drag-and-drop these objects from the left palette onto the designer canvas. All are fully tunable via the inspector.</P>
      <H2>Time display</H2>
      <UL>
        <li><strong>Analog clock</strong> — Dial with hands, reads the studio's current time.</li>
        <li><strong>Digital clock</strong> — Digital readout (HH:MM:SS), free font and color.</li>
        <li><strong>Date</strong> — Customizable text format (day, month, year, weekday…).</li>
        <li><strong>Timer</strong> — Elapsed / remaining time of the active countdown.</li>
        <li><strong>Progress bar</strong> / <strong>Progress ring</strong> — Visual representation of the timer with colored thresholds.</li>
      </UL>
      <H2>Branding</H2>
      <UL>
        <li><strong>Dynamic text</strong> — Free text with variables (<code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">{'{studioName}'}</code>, <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">{'{date}'}</code>, etc.).</li>
        <li><strong>Logo</strong> — Shows the studio logo uploaded in Settings.</li>
        <li><strong>Image</strong> — Pick from the gallery or upload directly.</li>
        <li><strong>Shape</strong> — Rectangle, circle, triangle, star (fill color + border).</li>
      </UL>
      <H2>Broadcast</H2>
      <UL>
        <li><strong>ON AIR badge</strong> — On / off following the ON AIR state, configurable blink animation.</li>
        <li><strong>Video</strong> — YouTube playback, uploaded file, or live NDI stream.</li>
        <li><strong>Planning</strong> — List of events from connected calendars.</li>
      </UL>
    </>
  );
}

function PaletteContentEN() {
  return (
    <>
      <P>The color palette is a <strong>shared list</strong> you build once in Settings, and which appears in every color picker of the designer. Handy to reuse the studio's brand colors without copy-pasting hex codes.</P>
      <H2>Add / edit</H2>
      <OL>
        <li>Go to <strong>Settings</strong> → <strong>Color palette</strong> card.</li>
        <li>Click <strong>Add</strong>. A new color (white) shows in the grid.</li>
        <li>Click the swatch to open the picker: HTML wheel, hex field, opacity slider.</li>
        <li>To remove, open the picker → <strong>Remove this color</strong> button at the bottom of the popover.</li>
      </OL>
      <H2>Format & transparency</H2>
      <P>All colors are stored as <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">#RRGGBBAA</code> (8 chars), with transparency from 0 to 100 %. The checkerboard under each swatch shows transparency at a glance.</P>
      <Note type="info">The app ships with 5 default broadcast-friendly colors (White, Grey, Black, ON AIR Red, Studio Blue). Feel free to remove / reorder / start from scratch.</Note>
    </>
  );
}

function ShortcutsContentEN() {
  return (
    <>
      <P>List of shortcuts available in the designer. On Mac, replace <KBD>Ctrl</KBD> with <KBD>⌘</KBD>.</P>
      <H2>Editing</H2>
      <div className="bg-black/30 rounded-md px-4 py-2 mb-4">
        <ShortcutRow keys={['Ctrl', 'Z']} label="Undo" />
        <ShortcutRow keys={['Ctrl', 'Shift', 'Z']} label="Redo" />
        <ShortcutRow keys={['Ctrl', 'S']} label="Save now (auto-save otherwise)" />
        <ShortcutRow keys={['Ctrl', 'D']} label="Duplicate selection" />
        <ShortcutRow keys={['Del']} label="Delete selection" />
        <ShortcutRow keys={['Esc']} label="Deselect / close popover" />
      </div>
      <H2>Movement</H2>
      <div className="bg-black/30 rounded-md px-4 py-2 mb-4">
        <ShortcutRow keys={['↑', '↓', '←', '→']} label="Move by 1 px" />
        <ShortcutRow keys={['Shift', '+ arrows']} label="Move by 10 px" />
      </div>
      <H2>Display</H2>
      <div className="bg-black/30 rounded-md px-4 py-2">
        <ShortcutRow keys={['F11']} label="Fullscreen (browser)" />
        <ShortcutRow keys={['F5']} label="Reload the studio screen" />
      </div>
    </>
  );
}

function FAQContentEN() {
  return (
    <>
      <H2>The ON AIR button is greyed out</H2>
      <P>The USB relay isn't detected. Check that it's properly plugged in and that the driver is recognized. Status is shown in <strong>Settings → Relay</strong>.</P>

      <H2>The studio screen stays black</H2>
      <P>No template is activated for the current mode (<strong>Active mode</strong> or <strong>Idle mode</strong>). Go to <strong>Design</strong>, select a template then click <strong>Activate</strong> at the top of the designer.</P>

      <H2>The timer drifts by a few seconds</H2>
      <P>Check NTP sync in <strong>Settings → Time</strong>. The dot must be green (LOCK). If amber, change the primary NTP server — the studio network often blocks <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">pool.ntp.org</code>.</P>

      <H2>My connected calendar shows the wrong events</H2>
      <P>In Calendars, click <strong>↻</strong> next to the affected account to force resync. If the issue persists, disconnect then reconnect the account.</P>

      <H2>I deleted a template by mistake</H2>
      <P>No automatic recovery — deletion is final. Best practice: <strong>Export to JSON</strong> the important templates from the designer toolbar to keep a local backup.</P>

      <H2>How do I share a template with another studio?</H2>
      <OL>
        <li>In Design, open the template to share.</li>
        <li>Click <strong>Export</strong> in the toolbar — a <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">.json</code> file is downloaded.</li>
        <li>On the other studio, click <strong>Import</strong> and pick the JSON.</li>
      </OL>

      <H2>Auto-save shows "Error"</H2>
      <P>The server is unreachable or the admin session expired. Reload the page — the app will prompt for new authentication if needed. Unsaved changes will be lost if the session is invalid.</P>

      <H2>The NDI Video widget finds no source</H2>
      <P>Check that at least one NDI encoder is active on the LAN. Discovery is via mDNS — your router must not filter multicast. If nothing shows in the list, restart the source NDI encoder.</P>
    </>
  );
}

function WiringContentEN() {
  return (
    <>
      <P>The studio uses a <strong>USB relay</strong> that drives the <strong>ON AIR lamp</strong> (red) and — depending on wiring — an <strong>idle / studio active indicator</strong> (green). These lights signal the studio state to everyone in real time.</P>

      <H2>Indicator behavior</H2>
      <UL>
        <li><Tag color="red">Red lamp</Tag> — solid on when <strong>ON AIR</strong> is active. Gently blinks if the timer is paused.</li>
        <li><Tag color="green">Green light</Tag> (optional, install-dependent) — solid on to signal the studio is <em>ready</em> or <em>idle</em>, off air.</li>
        <li>The two lights are <strong>mutually exclusive</strong> — only one is on at a time.</li>
      </UL>

      <H2>Activation from the app</H2>
      <UL>
        <li><strong>ON AIR</strong> button in the Control tab — toggles the red lamp.</li>
        <li>The green light comes on automatically when the timer is stopped or in idle mode (no action needed).</li>
        <li>During a timer pause, the red lamp stays on but blinks — visual signal "on-air pause, we'll be back".</li>
      </UL>

      <H2>Check relay status</H2>
      <P>Go to <strong>Settings → Relay</strong>. You'll see the live status:</P>
      <UL>
        <li><Tag color="green">Connected</Tag> — the USB relay is detected and operational.</li>
        <li><Tag color="amber">Disconnected</Tag> — USB cable unplugged or driver not loaded. The ON AIR button stays disabled while this status persists.</li>
      </UL>

      <H2>Wiring diagrams</H2>
      <P>Depending on the studio's configuration, the relay can be wired in 3 different ways. Here are the reference diagrams to identify yours and diagnose a problem locally.</P>

      <Note type="warn">The <strong>230 V</strong> wiring (primary side of the supply) must always be done powered off by a qualified person. The <strong>24 V</strong> side (low voltage) is safe for routine handling.</Note>

      <H2>Configuration 1 — Single lamp (1 channel, 1 red LED)</H2>
      <P>Basic setup: a single relay channel switches +24 V to a red lamp. The lamp lights up only when ON AIR is active.</P>
      <WiringDiagramSimple />

      <H2>Configuration 2 — Bicolor (1 channel, NO + NC, red / green)</H2>
      <P>Single 1-channel board driving 2 lamps. The <strong>NC</strong> contact powers the green (idle by default), the <strong>NO</strong> contact powers the red (on air). Auto-flip thanks to the relay's architecture.</P>
      <WiringDiagramBicolor />

      <H2>Configuration 3 — Two independent channels</H2>
      <P>2-channel relay board: channel 1 drives the on-air red, channel 2 drives the studio-active green. More flexible — each light can be controlled independently.</P>
      <WiringDiagramTwoChannel />

      <Note type="info">If something stops lighting up that used to work, first check the status in <strong>Settings → Relay</strong> (software) then the internal LEDs of the box (hardware). For any wiring intervention, contact whoever installed the system.</Note>
    </>
  );
}

function StreamDeckContentEN() {
  return (
    <>
      <P>OnAir Studio can be driven from an <strong>Elgato Stream Deck</strong> or any <strong>Bitfocus Companion</strong>-compatible controller. Ideal for having visible physical buttons in the control room: Start, Pause, ON AIR, duration presets…</P>

      <H2>Method 1 — Companion (recommended)</H2>
      <OL>
        <li>Install <strong>Bitfocus Companion</strong> on the machine connected to the Stream Deck.</li>
        <li>Add a <strong>Generic HTTP</strong> connection in Companion (Connections → +).</li>
        <li>For each button, configure an <strong>HTTP Request</strong> action that calls the matching OnAir Studio URL (see the list below).</li>
        <li>Optional: configure an <strong>HTTP Request</strong> as <em>feedback</em> on the status endpoint to light the Stream Deck button when the action is active (e.g. ON AIR lit red).</li>
      </OL>

      <H2>Method 2 — Native Stream Deck</H2>
      <P>Without Companion, use the <strong>API Ninja</strong> or <strong>Web Requests</strong> plugin from the Stream Deck Store. Configure each button to call the same URL via <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">POST</code>.</P>

      <H2>Useful buttons</H2>
      <P>All actions are <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">POST</code>s on your studio's IP/port (default <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">:3333</code>):</P>

      <div className="bg-black/30 rounded-md px-4 py-3 mb-4 space-y-2">
        <CommandRow label="Start the timer" cmd="POST /api/timer/start" />
        <CommandRow label="Pause" cmd="POST /api/timer/pause" />
        <CommandRow label="Resume" cmd="POST /api/timer/resume" />
        <CommandRow label="Stop" cmd="POST /api/timer/stop" />
        <CommandRow label="Mark a lap" cmd="POST /api/timer/lap" />
        <CommandRow label="ON AIR — turn on" cmd="POST /api/onair/on" />
        <CommandRow label="ON AIR — turn off" cmd="POST /api/onair/off" />
        <CommandRow label="ON AIR — toggle" cmd="POST /api/onair/toggle" />
        <CommandRow label="Set a duration (e.g. 26 min)" cmd='POST /api/timer/duration?value=00:26:00' />
      </div>

      <H2>Get the right base URL</H2>
      <P>The exact URL to use in Companion is the one shown in the browser bar when accessing the control panel, followed by the endpoint. Example: if you access OnAir Studio via <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">http://192.168.1.42:3333/control</code>, the URL to start the timer is <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">http://192.168.1.42:3333/api/timer/start</code>.</P>

      <Note type="warn">Depending on the config, the API may require the admin password. In Companion, add a <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">X-Admin-Password: your-password</code> header to the requests — check with your installer.</Note>

      <H2>Preset examples</H2>
      <UL>
        <li><strong>"26 MIN" button</strong> — calls <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">POST /api/timer/duration?value=00:26:00</code> then <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">POST /api/timer/start</code> in sequence.</li>
        <li><strong>Blinking red "ON AIR" button</strong> — toggles ON AIR + reads the state in Companion to physically blink the Stream Deck button while on air.</li>
        <li><strong>Panic "STOP" button</strong> — combines <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">/api/onair/off</code> + <code className="text-cyan-300 font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded">/api/timer/stop</code> to cut everything at once.</li>
      </UL>
    </>
  );
}
