import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import UpdatePanel from '../components/UpdatePanel';
import OptionGroup from '../components/OptionGroup';
import ColorPicker from '../components/ColorPicker';
import { useTimerState } from '../store/TimerContext';
import { useT, useTr } from '../hooks/useT';
import { getStoredAdminPassword, clearStoredAdminPassword } from '../components/AdminAuthGate';
import { apiChangeAdminPassword, apiUploadLogo, apiDeleteLogo, apiResetTemplates, apiResetSettings, apiResetAll, apiTestRelay } from '../store/templateStore';
import { useDialog } from '../components/Dialog';

const DEFAULTS = {
  studioName: 'OnAir Studio',
  ntpServers: ['pool.ntp.org', 'time.cloudflare.com', 'time.google.com'],
  timezone: 'Europe/Paris',
  language: 'fr',
  presetTimes: [
    { label: '12 min', value: '00:12:00' },
    { label: '26 min', value: '00:26:00' },
    { label: '52 min', value: '00:52:00' },
    { label: '90 min', value: '01:30:00' }
  ]
};

const COMMON_TIMEZONES = [
  'Europe/Paris','Europe/London','Europe/Berlin','Europe/Madrid','Europe/Rome','Europe/Lisbon',
  'Europe/Amsterdam','Europe/Brussels','Europe/Zurich',
  'Atlantic/Reykjavik','Atlantic/Canary',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Toronto','America/Mexico_City','America/Sao_Paulo',
  'Asia/Tokyo','Asia/Shanghai','Asia/Singapore','Asia/Dubai',
  'Australia/Sydney','Pacific/Auckland','UTC'
];

// Card : panneau — fond plat sombre, hairline 1px, header avec rule fine.
// L'icône reste en couleur neutre (slate) — pas d'accent par card. Le body
// est strictement clippé : pas de scroll vertical ni horizontal à l'intérieur,
// quel que soit le contenu (le contenu doit être dimensionné pour tenir).
// Le prop `accent` est conservé pour rétro-compat mais ignoré côté icône.
function Card({ icon, title, accent: _accent, children, headerRight, className = '' }) {
  return (
    <section className={`relative bg-slate-950/40 border border-white/5 rounded-xl flex flex-col min-h-0 overflow-hidden ${className}`}>
      <header className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="flex-shrink-0 text-slate-400">{icon}</span>}
          <h3 className="text-[11px] font-bold text-slate-100 uppercase tracking-[0.18em]">{title}</h3>
        </div>
        {headerRight}
      </header>
      <div className="px-4 py-3 flex-1 min-h-0 overflow-hidden">{children}</div>
    </section>
  );
}

// Petites icônes Lucide-style pour les headers de cards
const Icons = {
  clock: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  zap: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  shield: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  cpu: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="14" x2="22" y2="14"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="14" x2="4" y2="14"/></svg>,
  download: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  trash: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  palette: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.5 0 1-.4 1-1 0-.6-.5-1-1-1.5s-.5-1 0-1.5 1.5-.5 2-.5h1.5c2.4 0 4.5-2 4.5-4.5C20 6.5 16.4 2 12 2z"/></svg>
};

function ResetIcon({ onClick, show, title }) {
  if (!show) return null;
  return (
    <button type="button" onClick={onClick} title={title}
      className="p-1 rounded text-slate-500 hover:text-blue-400 hover:bg-slate-800/60 transition-colors flex-shrink-0">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg>
    </button>
  );
}

function Field({ label, hint, children, isModified, onReset, resetTitle }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">{label}</label>
        <ResetIcon show={!!isModified} onClick={onReset} title={resetTitle} />
      </div>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1.5">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, ...rest }) {
  return (
    <input value={value ?? ''} onChange={e => onChange(e.target.value)} {...rest}
      className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-slate-50 text-sm px-3 py-2 outline-none transition-colors" />
  );
}

function SelectInput({ value, onChange, options, ...rest }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} {...rest}
      className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-md text-slate-50 text-sm px-3 py-2 outline-none transition-colors">
      {options.map(opt =>
        typeof opt === 'string'
          ? <option key={opt} value={opt}>{opt}</option>
          : <option key={opt.value} value={opt.value}>{opt.label}</option>
      )}
    </select>
  );
}

function AutoSaveBadge({ status, t }) {
  if (status === 'idle') return null;
  const cfg =
    status === 'saving' ? { cls: 'bg-amber-500/15 border-amber-500/40 text-amber-200', label: t('common.saving'),
      icon: <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> }
    : status === 'saved' ? { cls: 'bg-green-500/15 border-green-500/40 text-green-200', label: t('common.saved'),
      icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> }
    : { cls: 'bg-red-500/15 border-red-500/40 text-red-200', label: t('common.error'),
      icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> };
  return (
    <div className={`fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border backdrop-blur-md shadow-lg ${cfg.cls}`}>
      {cfg.icon}<span>{cfg.label}</span>
    </div>
  );
}

function pad(n) { return String(n).padStart(2, '0'); }
function formatTimeInTz(date, tz, lang) {
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(date);
  } catch { return '—'; }
}
function formatDateInTz(date, tz, lang) {
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
      timeZone: tz, weekday: 'short', day: '2-digit', month: 'short'
    }).format(date);
  } catch { return ''; }
}
function formatUTC(date) {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export default function SettingsPanel() {
  const t = useT();
  const tr = useTr();
  const dialog = useDialog();
  const timerState = useTimerState();

  const [settings, setSettings] = useState({
    ntpServers: ['', '', ''], studioName: '',
    timezone: DEFAULTS.timezone, language: DEFAULTS.language,
    relayType: 'usb', relayIp: '', relayChannels: 2, presetTimes: [], colorPalette: []
  });
  const [originalSettings, setOriginalSettings] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef(null);

  const [newPresetMin, setNewPresetMin] = useState(15);
  const [pwForm, setPwForm] = useState({ next: '', confirm: '' });
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  // Test du relais (latch) — état local par canal, indépendant de ON AIR.
  // { 1: false, 2: true, ... } — true = canal forcé ON, false = forcé OFF.
  // Pas persisté : le test est éphémère.
  const [latchState, setLatchState] = useState({});
  const [latchBusy, setLatchBusy] = useState(null); // canal en cours d'envoi
  const handleLatchToggle = async (channel) => {
    const next = !latchState[channel];
    setLatchBusy(channel);
    try {
      await apiTestRelay(channel, next);
      setLatchState(s => ({ ...s, [channel]: next }));
    } catch (e) {
      showToast('Erreur relais : ' + e.message, 'error');
    } finally {
      setLatchBusy(null);
    }
  };

  const [logoVersion, setLogoVersion] = useState(Date.now());
  const [logoBusy, setLogoBusy] = useState(false);
  const [hasLogo, setHasLogo] = useState(true);
  const fileInputRef = useRef(null);

  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800);
  };

  useEffect(() => {
    socket.emit('requestSettings');
    const onSettings = (s) => {
      const rawServers = Array.isArray(s.ntpServers) ? s.ntpServers : (s.ntpServer ? [s.ntpServer] : []);
      const ntpServers = [rawServers[0] || '', rawServers[1] || '', rawServers[2] || ''];
      const compact = {
        ntpServers, studioName: s.studioName || '',
        timezone: s.timezone || DEFAULTS.timezone,
        language: s.language || DEFAULTS.language,
        relayType: s.relayType || 'usb', relayIp: s.relayIp || '',
        relayChannels: Number.isFinite(s.relayChannels) && s.relayChannels > 0 ? s.relayChannels : 2,
        presetTimes: Array.isArray(s.presetTimes) ? s.presetTimes : [],
        colorPalette: Array.isArray(s.colorPalette) ? s.colorPalette : []
      };
      setSettings(compact);
      setOriginalSettings(compact);
      dirtyRef.current = false;
    };
    socket.on('settingsUpdate', onSettings);
    return () => socket.off('settingsUpdate', onSettings);
  }, []);

  useEffect(() => {
    if (!originalSettings || !dirtyRef.current) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const payload = {
        ...settings,
        ntpServer: settings.ntpServers.find(s => s) || '',
        ntpServers: settings.ntpServers.filter(s => s).slice(0, 3)
      };
      socket.emit('updateSettings', payload);
      setOriginalSettings(settings);
      dirtyRef.current = false;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000);
    }, 1200);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [settings, originalSettings]);

  const setSettingsField = (k, v) => { dirtyRef.current = true; setSettings(prev => ({ ...prev, [k]: v })); };
  const setNtpServerAt = (idx, v) => {
    dirtyRef.current = true;
    setSettings(prev => ({ ...prev, ntpServers: prev.ntpServers.map((s, i) => i === idx ? v : s) }));
  };
  const resetField = (k) => setSettingsField(k, DEFAULTS[k]);
  const resetNtpServers = () => setSettingsField('ntpServers', [...DEFAULTS.ntpServers]);

  const minutesToHMS = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`;
  const addPreset = () => {
    const m = parseInt(newPresetMin) || 0;
    if (m <= 0 || m > 999) return;
    dirtyRef.current = true;
    setSettings(prev => ({ ...prev, presetTimes: [...prev.presetTimes, { label: `${m} min`, value: minutesToHMS(m) }] }));
    setNewPresetMin(15);
  };
  const removePreset = (i) => {
    dirtyRef.current = true;
    setSettings(prev => ({ ...prev, presetTimes: prev.presetTimes.filter((_, idx) => idx !== i) }));
  };
  const resetPresets = () => {
    dirtyRef.current = true;
    setSettings(prev => ({ ...prev, presetTimes: [...DEFAULTS.presetTimes] }));
  };

  // ── Palette : CRUD léger sur l'array colorPalette ────────────────────────
  // Format d'une couleur : { id: string, name: string, value: '#RRGGBBAA' }
  const addPaletteColor = () => {
    dirtyRef.current = true;
    const id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const next = { id, name: '', value: '#FFFFFFFF' };
    setSettings(prev => ({ ...prev, colorPalette: [...(prev.colorPalette || []), next] }));
  };
  const updatePaletteColor = (id, changes) => {
    dirtyRef.current = true;
    setSettings(prev => ({
      ...prev,
      colorPalette: (prev.colorPalette || []).map(c => c.id === id ? { ...c, ...changes } : c)
    }));
  };
  const removePaletteColor = (id) => {
    dirtyRef.current = true;
    setSettings(prev => ({ ...prev, colorPalette: (prev.colorPalette || []).filter(c => c.id !== id) }));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwErr('');
    if (pwForm.next.length < 4) { setPwErr(t('settings.security.err.too_short')); return; }
    if (pwForm.next !== pwForm.confirm) { setPwErr(t('settings.security.err.mismatch')); return; }
    if (!getStoredAdminPassword()) { setPwErr(t('settings.security.err.unauth')); return; }
    setPwBusy(true);
    try {
      await apiChangeAdminPassword(pwForm.next);
      clearStoredAdminPassword();
      showToast(t('settings.security.success'), 'success');
      setPwForm({ next: '', confirm: '' });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) { setPwErr(err.message); } finally { setPwBusy(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoBusy(true);
    try {
      await apiUploadLogo(file);
      setHasLogo(true); setLogoVersion(Date.now());
      showToast(t('settings.identity.logo.uploaded'), 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLogoBusy(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  // ── Reset / réinitialisation ────────────────────────────────────────────
  const [resetBusy, setResetBusy] = useState(null); // 'templates' | 'settings' | 'all' | null

  const handleResetTemplates = async () => {
    const ok = await dialog.confirm({
      title: 'Supprimer toutes les données utilisateurs ?',
      message:
        'Cela efface :\n' +
        '  • tous les templates créés\n' +
        '  • toutes les images et vidéos uploadées\n' +
        '  • tous les comptes calendriers connectés (Google / Microsoft / Apple)\n\n' +
        'Les modèles factory (2 horloges, 3 horloges, veille) et les credentials OAuth globaux sont conservés.\n\n' +
        'Cette action est irréversible.',
      confirmLabel: 'Tout supprimer',
      danger: true
    });
    if (!ok) return;
    setResetBusy('templates');
    try {
      const r = await apiResetTemplates();
      const tCount = r.deletedTemplates ?? r.deleted ?? 0;
      const uCount = r.deletedUploads ?? 0;
      const aCount = r.deletedAccounts ?? 0;
      showToast(
        `${tCount} template${tCount > 1 ? 's' : ''}, ${uCount} fichier${uCount > 1 ? 's' : ''}, ${aCount} compte${aCount > 1 ? 's' : ''} calendrier supprimés.`,
        'success'
      );
    } catch (e) { showToast(e.message, 'error'); }
    finally { setResetBusy(null); }
  };

  const handleResetSettings = async () => {
    const ok = await dialog.confirm({
      title: 'Remettre les réglages par défaut ?',
      message:
        'Cela réinitialise : nom du studio, langue, fuseau horaire, serveurs NTP, type de relais et préréglages chrono.\n\n' +
        'Le mot de passe admin et les templates ne sont pas affectés.\n\n' +
        'Cette action est irréversible.',
      confirmLabel: 'Réinitialiser',
      danger: true
    });
    if (!ok) return;
    setResetBusy('settings');
    try {
      await apiResetSettings();
      showToast('Réglages remis par défaut.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setResetBusy(null); }
  };

  // Reset total : combine settings + données + comptes/credentials calendriers
  // + branding logo. Seul le mot de passe admin est conservé (sinon on serait
  // kické dehors).
  const handleResetAll = async () => {
    const ok = await dialog.confirm({
      title: 'Tout réinitialiser ?',
      message:
        'Cela remet l\'application à zéro :\n' +
        '  • réglages (studio, langue, fuseau, NTP, relais, préréglages)\n' +
        '  • palette de couleurs\n' +
        '  • templates utilisateurs\n' +
        '  • images / vidéos uploadées\n' +
        '  • comptes calendriers connectés + credentials OAuth\n' +
        '  • logo personnalisé\n\n' +
        'Seul le mot de passe administrateur est conservé.\n\n' +
        'Cette action est irréversible.',
      confirmLabel: 'Tout réinitialiser',
      danger: true
    });
    if (!ok) return;
    setResetBusy('all');
    try {
      const r = await apiResetAll();
      const tCount = r.deletedTemplates ?? 0;
      const uCount = r.deletedUploads ?? 0;
      const aCount = r.deletedAccounts ?? 0;
      showToast(
        `Application réinitialisée. ${tCount} template${tCount > 1 ? 's' : ''}, ${uCount} fichier${uCount > 1 ? 's' : ''}, ${aCount} compte${aCount > 1 ? 's' : ''} calendrier, logo supprimés.`,
        'success'
      );
    } catch (e) { showToast(e.message, 'error'); }
    finally { setResetBusy(null); }
  };

  const handleLogoDelete = async () => {
    const ok = await dialog.confirm({
      title: 'Supprimer le logo ?',
      message: t('settings.identity.logo.confirm_delete'),
      confirmLabel: 'Supprimer',
      danger: true
    });
    if (!ok) return;
    setLogoBusy(true);
    try { await apiDeleteLogo(); setHasLogo(false); setLogoVersion(Date.now()); showToast(t('settings.identity.logo.deleted'), 'info'); }
    catch (err) { showToast(err.message, 'error'); }
    finally { setLogoBusy(false); }
  };

  const studioModified = settings.studioName && settings.studioName !== DEFAULTS.studioName;
  const tzModified = settings.timezone && settings.timezone !== DEFAULTS.timezone;
  const langModified = settings.language && settings.language !== DEFAULTS.language;
  const ntpsModified = JSON.stringify(settings.ntpServers.filter(Boolean)) !== JSON.stringify(DEFAULTS.ntpServers);
  const presetsModified = JSON.stringify(settings.presetTimes) !== JSON.stringify(DEFAULTS.presetTimes);

  const utcTime = formatUTC(now);
  const localTime = formatTimeInTz(now, settings.timezone, settings.language);
  const localDate = formatDateInTz(now, settings.timezone, settings.language);

  return (
    <div className="h-full overflow-hidden bg-ink p-3 flex flex-col gap-3 text-slate-200">

      {/* ─────────── HERO — bandeau régie : identité + heures ─────────── */}
      <header className="flex-shrink-0 relative bg-slate-950/60 border border-white/5 rounded-xl px-5 py-4 flex items-stretch gap-5">
        {/* Logo (cellule encastrée) */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={logoBusy}
          title={t('settings.identity.logo.upload')}
          className="group relative w-24 h-24 bg-black border border-white/10 hover:border-cyan-400/60 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors"
        >
          {hasLogo ? (
            <img key={logoVersion} src={`/api/branding/logo?v=${logoVersion}`} alt="Logo"
              onError={() => setHasLogo(false)} onLoad={() => setHasLogo(true)}
              className="w-full h-full object-contain" />
          ) : (
            // Pas de logo studio → on retombe sur le logo OnAir Studio par défaut
            // (présent dans /public/logo.png — même fallback que LogoObject côté designer).
            <img src="/logo.png" alt="OnAir Studio" className="w-full h-full object-contain opacity-80" />
          )}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
        </button>

        {/* Studio name + langue */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-400/80 font-semibold">STUDIO·ID</span>
            <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/30 via-white/5 to-transparent" />
            <ResetIcon show={studioModified} onClick={() => resetField('studioName')} title={t('common.reset_default')} />
          </div>
          <input value={settings.studioName ?? ''} onChange={e => setSettingsField('studioName', e.target.value)}
            placeholder={DEFAULTS.studioName}
            className="w-full bg-transparent text-slate-50 text-3xl font-bold tracking-tight outline-none border-b border-transparent hover:border-white/10 focus:border-cyan-400 transition-colors py-0.5" />
          <div className="flex items-center gap-3 mt-0.5">
            <OptionGroup
              size="sm"
              value={settings.language}
              onChange={(v) => setSettingsField('language', v)}
              options={[
                { value: 'fr', label: 'FR', icon: <span className="text-sm leading-none">🇫🇷</span> },
                { value: 'en', label: 'EN', icon: <span className="text-sm leading-none">🇬🇧</span> }
              ]}
            />
            {hasLogo && (
              <button onClick={handleLogoDelete} disabled={logoBusy}
                className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors">
                {t('settings.identity.logo.delete')}
              </button>
            )}
          </div>
        </div>

        {/* Cluster horloges — labels courts ("UTC" / "LOCAL") inline avec les
            chiffres, sur 2 lignes. Pas de t() ici : les abréviations sont
            universelles FR/EN et ça évite les labels longs ("Heure locale")
            qui débordent. */}
        <div className="flex flex-col justify-center gap-1.5 pl-6 border-l border-white/10 flex-shrink-0">
          <div className="flex items-baseline gap-2.5 whitespace-nowrap">
            <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-semibold w-10 flex-shrink-0 text-right">UTC</span>
            <span className="text-2xl font-mono font-bold text-slate-100 tabular-nums leading-none">{utcTime}</span>
          </div>
          <div className="flex items-baseline gap-2.5 whitespace-nowrap">
            <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-semibold w-10 flex-shrink-0 text-right">LOCAL</span>
            <span className="text-2xl font-mono font-bold text-cyan-300 tabular-nums leading-none">{localTime}</span>
          </div>
          <p className="text-[10px] text-slate-500 capitalize tracking-wide whitespace-nowrap pl-[50px]">{localDate}</p>
        </div>
      </header>

      {/* ─────────── GRILLE — 12 cols, 2 rows STRICTEMENT égales ───────────
          `auto-rows-fr` + `[grid-template-rows:1fr_1fr]` garantit que les 2
          rangées prennent exactement la même hauteur, peu importe la densité
          de contenu de chaque carte (l'overflow-y-auto interne de chaque Card
          gère un éventuel dépassement). */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 [grid-template-rows:1fr_1fr] auto-rows-fr">

        {/* ROW 1 */}
        {/* TIME / NTP — col-span-5 */}
        <Card icon={Icons.clock} accent="cyan" title={t('settings.time.title')} className="col-start-1 col-span-5 row-start-1">
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="space-y-3">
              <Field label={t('settings.time.tz')} isModified={tzModified} onReset={() => resetField('timezone')} resetTitle={t('common.reset_default')}>
                <SelectInput value={settings.timezone} onChange={(v) => setSettingsField('timezone', v)} options={COMMON_TIMEZONES} />
              </Field>

              <div className="bg-black/40 border border-white/5 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${timerState.isNTPActive ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)] animate-pulse' : 'bg-amber-500'}`} />
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300 font-semibold">NTP·SYNC</span>
                  </span>
                  <span className={`text-[11px] font-mono uppercase tracking-wider ${timerState.isNTPActive ? 'text-green-300' : 'text-amber-300'}`}>
                    {timerState.isNTPActive ? 'LOCK' : 'OFFLINE'}
                  </span>
                </div>
                {timerState.isNTPActive && timerState.currentNtpServer && (
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    → <span className="font-mono text-slate-300">{timerState.currentNtpServer}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-semibold">{t('settings.time.servers')}</label>
                <ResetIcon show={ntpsModified} onClick={resetNtpServers} title={t('common.reset_default')} />
              </div>
              <div className="space-y-1.5">
                {[
                  { i: 0, glyph: '01' },
                  { i: 1, glyph: '02' },
                  { i: 2, glyph: '03' }
                ].map(({ i, glyph }) => {
                  const isActive = timerState.currentNtpServer === settings.ntpServers[i] && settings.ntpServers[i];
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-600 tracking-wider w-6 flex-shrink-0">{glyph}</span>
                      <TextInput value={settings.ntpServers[i] || ''} onChange={(v) => setNtpServerAt(i, v)} placeholder={DEFAULTS.ntpServers[i]} />
                      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full transition-colors ${isActive ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.9)]' : 'bg-slate-700'}`}
                        title={isActive ? t('settings.time.connected_to') : ''} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* PRESETS — row 1, cols 6-8 */}
        <Card
          icon={Icons.zap} accent="amber"
          title={t('settings.presets.title')}
          headerRight={<ResetIcon show={presetsModified} onClick={resetPresets} title={t('settings.presets.reset_title')} />}
          className="col-start-6 col-span-3 row-start-1"
        >
          <div className="flex flex-col h-full">
            {settings.presetTimes.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic flex-1">{t('settings.presets.empty')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 flex-1 overflow-hidden content-start">
                {settings.presetTimes.map((p, i) => (
                  <div key={`${p.value}-${i}`} className="group flex items-center gap-1.5 bg-black/40 hover:bg-black/60 border border-white/5 hover:border-amber-400/40 px-2 py-1.5 transition-colors">
                    <span className="text-sm text-slate-100 font-medium flex-1 truncate">{p.label}</span>
                    <span className="text-[10px] font-mono text-slate-500 tabular-nums">{p.value}</span>
                    <button onClick={() => removePreset(i)} className="p-0.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title={t('settings.presets.delete_title')}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 6l12 12M6 18L18 6" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-2.5 mt-2.5 border-t border-white/5 flex-shrink-0">
              <input type="number" min="1" max="999" value={newPresetMin} onChange={e => setNewPresetMin(e.target.value)}
                className="w-14 bg-black/60 border border-white/10 focus:border-amber-400 text-slate-50 text-sm px-2 py-2 outline-none text-center font-mono tabular-nums" />
              <span className="text-[11px] uppercase tracking-wider text-slate-500">min</span>
              <span className="text-[10px] text-slate-600 font-mono flex-1 truncate">→ {minutesToHMS(parseInt(newPresetMin) || 0)}</span>
              <button onClick={addPreset}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium transition-colors flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
                {t('settings.presets.add')}
              </button>
            </div>
          </div>
        </Card>

        {/* PALETTE — col-span-3 (déplacée en row 2 pour libérer la place du
            RELAY qui a besoin de plus d'espace pour ses 3 cards de câblage) */}
        <Card
          icon={Icons.palette} accent="purple"
          title="Palette"
          headerRight={
            <button
              type="button"
              onClick={addPaletteColor}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
              Ajouter
            </button>
          }
          className="col-start-4 col-span-3 row-start-2"
        >
          {settings.colorPalette.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="grid grid-cols-3 gap-1 mb-3 opacity-30">
                {['#0ea5e9','#a78bfa','#fb923c','#22d3ee','#f472b6','#facc15','#84cc16','#f87171','#94a3b8'].map(c => (
                  <span key={c} className="w-4 h-4" style={{ backgroundColor: c }} />
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-[200px]">
                {tr({ fr: 'Aucune couleur. Construisez votre palette pour la retrouver dans tous les pickers du designer.', en: 'No colors yet. Build your palette to reuse it in every designer picker.' })}
              </p>
            </div>
          ) : (
            // Grille de gros swatches : un clic ouvre le menu contextuel
            // (popover) avec édition + bouton "Supprimer cette couleur" en
            // bas. Pas de × séparé — l'affordance destructive est dans le
            // menu, pas un mystérieux carré gris.
            <div className="flex flex-wrap gap-3 content-start">
              {settings.colorPalette.map(c => (
                <ColorPicker
                  key={c.id}
                  compact
                  hidePalette
                  triggerClassName="w-16 h-16"
                  value={c.value}
                  onChange={v => updatePaletteColor(c.id, { value: v })}
                  onDelete={() => removePaletteColor(c.id)}
                />
              ))}
            </div>
          )}
        </Card>

        {/* ROW 2 */}
        {/* SECURITY — col-span-3 */}
        <Card icon={Icons.shield} accent="green" title={t('settings.security.title')} className="col-start-1 col-span-3 row-start-2">
          <form onSubmit={handleChangePassword} className="space-y-2.5">
            <Field label={t('settings.security.new_password')}>
              <TextInput type="password" autoComplete="new-password" value={pwForm.next} onChange={(v) => setPwForm({ ...pwForm, next: v })} />
            </Field>
            <Field label={t('settings.security.confirm')}>
              <TextInput type="password" autoComplete="new-password" value={pwForm.confirm} onChange={(v) => setPwForm({ ...pwForm, confirm: v })} />
            </Field>
            {pwErr && <p className="text-[11px] text-red-400">{pwErr}</p>}
            <button type="submit" disabled={pwBusy || !pwForm.next || !pwForm.confirm}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-1.5">
              {pwBusy ? t('settings.security.submit_busy') : t('settings.security.submit')}
            </button>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('settings.security.disconnect_warning')}</p>
          </form>
        </Card>

        {/* RELAY — col-span-4 (élargi : les 3 cards de configuration de
            câblage ont besoin de place pour rester lisibles) */}
        <Card icon={Icons.cpu} accent="red" title={t('settings.relay.title')} className="col-start-9 col-span-4 row-start-1">
          <div className="space-y-4">
            {/* Ligne 1 : type de relais (USB/ETH) + statut connecté/déconnecté
                côte à côte. Économie de hauteur par rapport à 2 blocs empilés. */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <OptionGroup
                  size="sm"
                  value={settings.relayType}
                  onChange={(v) => setSettingsField('relayType', v)}
                  options={[
                    {
                      value: 'usb',
                      label: t('settings.relay.type.usb'),
                      icon: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="9"/><polyline points="9 6 12 9 15 6"/><rect x="6" y="9" width="12" height="14" rx="2"/></svg>
                    },
                    {
                      value: 'ethernet',
                      disabled: true,
                      hint: tr({ fr: 'Bientôt disponible — actuellement en développement', en: 'Coming soon — currently in development' }),
                      label: <span className="inline-flex items-center gap-1 uppercase">ETHERNET<span className="text-[8px] uppercase tracking-wider bg-amber-500/30 text-amber-200 border border-amber-500/40 px-1 py-px">DEV</span></span>,
                      icon: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="9" width="20" height="6" rx="1"/><line x1="6" y1="9" x2="6" y2="15"/><line x1="10" y1="9" x2="10" y2="15"/><line x1="14" y1="9" x2="14" y2="15"/><line x1="18" y1="9" x2="18" y2="15"/></svg>
                    }
                  ]}
                />
              </div>
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-2 py-1.5 rounded-md flex-shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  settings.relayType === 'ethernet' ? 'bg-slate-600'
                  : timerState.usbRelayStatus ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.9)] animate-pulse' : 'bg-amber-500'
                }`} />
                <span className={`text-[10px] font-mono uppercase tracking-wider ${
                  settings.relayType === 'ethernet' ? 'text-slate-500'
                  : timerState.usbRelayStatus ? 'text-green-300' : 'text-amber-300'
                }`}>
                  {settings.relayType === 'ethernet'
                    ? 'N/A'
                    : timerState.usbRelayStatus
                      ? t('settings.relay.connected')
                      : t('settings.relay.disconnected')}
                </span>
              </div>
            </div>

            {/* Type de câblage + test latch — uniquement pour USB.
                Format compact : titre + badge sur 1 ligne, description sur
                la 2e ligne. Réduit la hauteur globale ~30 % par rapport
                à un layout 2 lignes par card. */}
            {settings.relayType === 'usb' && (() => {
              const STORAGE_KEY = 'onair.relayConfig';
              const stored = Number(localStorage.getItem(STORAGE_KEY));
              const initialConfig = [1, 2, 3].includes(stored)
                ? stored
                : (settings.relayChannels >= 2 ? 3 : 1);
              const setConfig = (cfg) => {
                localStorage.setItem(STORAGE_KEY, String(cfg));
                const channels = cfg === 3 ? 2 : 1;
                setSettingsField('relayChannels', channels);
              };
              const wiringOptions = [
                {
                  value: 1,
                  title: tr({ fr: 'Lampe simple', en: 'Single lamp' }),
                  desc: tr({ fr: '1 lampe rouge — allumée uniquement quand ON AIR.', en: '1 red lamp — lit only when ON AIR.' }),
                  badge: '1 ch'
                },
                {
                  value: 2,
                  title: tr({ fr: 'Bicolore', en: 'Bicolor' }),
                  desc: tr({ fr: 'Vert au repos (NC) / rouge antenne (NO). Bascule auto.', en: 'Green idle (NC) / red on air (NO). Auto-toggle.' }),
                  badge: '1 ch'
                },
                {
                  value: 3,
                  title: tr({ fr: '2 canaux indép.', en: '2 indep. channels' }),
                  desc: tr({ fr: 'Canal 1 rouge + canal 2 vert, contrôlés séparément.', en: 'Channel 1 red + channel 2 green, controlled separately.' }),
                  badge: '2 ch'
                }
              ];
              return (
                <>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">
                      {tr({ fr: 'Type de câblage', en: 'Wiring type' })}
                    </label>
                    {/* 3 colonnes — descriptions complètes affichées
                        directement, pas de tronquage, padding généreux. */}
                    <div className="grid grid-cols-3 gap-2">
                      {wiringOptions.map(opt => {
                        const active = initialConfig === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setConfig(opt.value)}
                            className={`text-left rounded-md border px-3 py-3 transition-colors flex flex-col gap-1.5 ${
                              active
                                ? 'bg-blue-600/15 border-blue-500'
                                : 'bg-slate-900/60 border-white/5 hover:border-blue-500/40'
                            }`}
                          >
                            <div className="flex items-baseline justify-between gap-1">
                              <span className={`text-xs font-semibold leading-tight ${active ? 'text-white' : 'text-slate-200'}`}>
                                {opt.title}
                              </span>
                              <span className={`text-[10px] font-mono shrink-0 ${active ? 'text-blue-300' : 'text-slate-500'}`}>
                                {opt.badge}
                              </span>
                            </div>
                            <p className={`text-[11px] leading-snug ${active ? 'text-blue-100/80' : 'text-slate-500'}`}>
                              {opt.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Test latch — bloc à part avec label dédié et boutons
                      hauts pour un confort de clic + une lisibilité claire. */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
                      {tr({ fr: 'Test des canaux', en: 'Channel test' })}
                    </label>
                    <div
                      className="grid gap-2"
                      style={{ gridTemplateColumns: `repeat(${Math.min(settings.relayChannels, 8)}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: settings.relayChannels }).map((_, i) => {
                        const channel = i + 1;
                        const on = !!latchState[channel];
                        const busy = latchBusy === channel;
                        return (
                          <button
                            key={channel}
                            type="button"
                            onClick={() => handleLatchToggle(channel)}
                            disabled={!timerState.usbRelayStatus || busy}
                            title={`Canal ${channel} — ${on ? 'forcé ON' : 'OFF'}`}
                            className={`h-10 flex items-center justify-center gap-1.5 text-sm font-mono font-bold rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                              on
                                ? 'bg-red-500/30 border border-red-400/60 text-red-100 shadow-[0_0_8px_rgba(248,113,113,0.5)]'
                                : 'bg-black/40 border border-white/10 text-slate-300 hover:bg-slate-800/60'
                            }`}
                          >
                            <span>CH{channel}</span>
                            <span className={`text-[10px] font-mono ${on ? 'text-red-200' : 'text-slate-500'}`}>
                              {busy ? '…' : on ? 'ON' : 'OFF'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </Card>

        {/* UPDATE — col-span-3 */}
        <Card icon={Icons.download} accent="blue" title={t('settings.update.title')} className="col-start-7 col-span-3 row-start-2">
          <UpdatePanel adminPassword={getStoredAdminPassword()} timerIsRunning={timerState.isRunning} onShowToast={showToast} />
        </Card>

        {/* RESET ZONE — col-span-3 (panneau "danger") */}
        <Card icon={Icons.trash} accent="red" title={tr({ fr: 'Réinitialisation', en: 'Reset' })} className="col-start-10 col-span-3 row-start-2">
          <div className="space-y-2">
            <button onClick={handleResetTemplates} disabled={resetBusy !== null}
              className="w-full text-left bg-black/40 hover:bg-red-950/40 border border-white/5 hover:border-red-500/40 px-3 py-2.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-slate-200 group-hover:text-red-200">{tr({ fr: 'Données', en: 'Data' })}</span>
                <span className="text-[11px] font-mono text-slate-500 group-hover:text-red-300">
                  {resetBusy === 'templates' ? '…' : '⟶'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                {tr({ fr: 'Templates utilisateurs, images / vidéos uploadées, comptes calendriers. Modèles factory et credentials OAuth conservés.', en: 'User templates, uploaded images / videos, calendar accounts. Factory models and OAuth credentials are kept.' })}
              </p>
            </button>

            <button onClick={handleResetSettings} disabled={resetBusy !== null}
              className="w-full text-left bg-black/40 hover:bg-red-950/40 border border-white/5 hover:border-red-500/40 px-3 py-2.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-slate-200 group-hover:text-red-200">{tr({ fr: 'Réglages par défaut', en: 'Default settings' })}</span>
                <span className="text-[11px] font-mono text-slate-500 group-hover:text-red-300">
                  {resetBusy === 'settings' ? '…' : '⟶'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                {tr({ fr: 'Nom, langue, fuseau, NTP, relais, préréglages. Conserve mot de passe et templates.', en: 'Name, language, timezone, NTP, relay, presets. Keeps password and templates.' })}
              </p>
            </button>

            <button onClick={handleResetAll} disabled={resetBusy !== null}
              className="w-full text-left bg-red-950/30 hover:bg-red-950/60 border border-red-500/30 hover:border-red-500/60 px-3 py-2.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed group">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-red-200">{tr({ fr: 'Tout réinitialiser', en: 'Reset everything' })}</span>
                <span className="text-[11px] font-mono text-red-400 group-hover:text-red-200">
                  {resetBusy === 'all' ? '…' : '⟶'}
                </span>
              </div>
              <p className="text-[10px] text-red-400/70 mt-1 leading-snug">
                {tr({ fr: 'Réglages + données + logo personnalisé. Conserve uniquement le mot de passe admin.', en: 'Settings + data + custom logo. Only the admin password is kept.' })}
              </p>
            </button>

            <p className="text-[10px] text-red-400/70 italic flex items-center gap-1.5 pt-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
              {tr({ fr: 'Actions irréversibles', en: 'Irreversible actions' })}
            </p>
          </div>
        </Card>
      </div>

      <AutoSaveBadge status={saveStatus} t={t} />

      <div className="fixed top-20 right-6 z-50 space-y-2 max-w-sm">
        {toasts.map((t) => (
          <div key={t.id}
            className={`px-4 py-3 border-l-4 shadow-lg backdrop-blur-md text-sm ${
              t.type === 'success' ? 'bg-green-500/15 border-green-500 text-green-200'
              : t.type === 'error' ? 'bg-red-500/15 border-red-500 text-red-200'
              : 'bg-blue-500/15 border-blue-500 text-blue-200'
            }`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
