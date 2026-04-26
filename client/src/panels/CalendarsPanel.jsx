import React, { useEffect, useState, useRef } from 'react';
import { socket } from '../socket';
import {
  apiGetCalendarCredentials, apiSetCalendarCredentials,
  apiListCalendarAccounts, apiDeleteCalendarAccount, apiRefreshCalendarAccount, apiRenameCalendarAccount,
  apiAuthorizeGoogle, apiAuthorizeMicrosoft, apiConnectApple
} from '../store/calendarStore';
import { useDialog } from '../components/Dialog';
import { useTr } from '../hooks/useT';

// ── Logos providers (SVG officiels simplifiés) ─────────────────────────────

const ProviderLogo = ({ provider, className = 'w-5 h-5' }) => {
  if (provider === 'google') return (
    <svg className={className} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
  if (provider === 'microsoft') return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#F25022" d="M0 0h11.4v11.4H0z"/>
      <path fill="#7FBA00" d="M12.6 0H24v11.4H12.6z"/>
      <path fill="#00A4EF" d="M0 12.6h11.4V24H0z"/>
      <path fill="#FFB900" d="M12.6 12.6H24V24H12.6z"/>
    </svg>
  );
  if (provider === 'apple') return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
  return null;
};

// ── UI primitives — alignées sur le design du SettingsPanel ────────────────

// Card : panneau plat sombre, hairline 1px, header avec rule fine. L'icône
// est neutre (slate). Body strictement clippé : pas de scroll interne.
function Card({ icon, title, children, headerRight, className = '' }) {
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

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">{label}</label>
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

function PrimaryButton({ children, ...rest }) {
  return (
    <button {...rest}
      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs rounded font-medium transition-colors">
      {children}
    </button>
  );
}

function GhostButton({ children, ...rest }) {
  return (
    <button {...rest}
      className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs rounded transition-colors border border-white/10">
      {children}
    </button>
  );
}

function DangerButton({ children, ...rest }) {
  return (
    <button {...rest}
      className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 disabled:opacity-40 disabled:cursor-not-allowed text-red-200 text-xs rounded transition-colors">
      {children}
    </button>
  );
}

// Icônes Lucide-style (taille 18 comme SettingsPanel)
const Icons = {
  google: <ProviderLogo provider="google" className="w-[18px] h-[18px]" />,
  microsoft: <ProviderLogo provider="microsoft" className="w-[18px] h-[18px]" />,
  users: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  calendar: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
};

// ── RedirectUriBox : URL exacte de callback OAuth ───────────────────────────
function RedirectUriBox({ provider }) {
  const uri = `${window.location.origin}/api/calendar/${provider}/callback`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(uri); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch {}
  };
  return (
    <div className="bg-black/40 border border-amber-500/30 rounded-md px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[10px] uppercase tracking-widest text-amber-300 font-semibold">URI de redirection</p>
        <button onClick={copy}
          className="px-2 py-0.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 rounded text-[10px] text-blue-200 transition-colors flex-shrink-0">
          {copied ? '✓ Copié' : 'Copier'}
        </button>
      </div>
      <code className="block text-[10px] text-blue-300 font-mono break-all select-all leading-tight">{uri}</code>
    </div>
  );
}

// ── CredentialsForm — utilisé uniquement DANS le modal OAuthConfigModal ────
// (forceEditing=true) — l'affichage compact est désormais inline dans la
// card du provider.
function CredentialsForm({ provider, fields, creds, onSaved, forceEditing = false }) {
  const tr = useTr();
  const [editing, setEditing] = useState(forceEditing || !creds);
  const [clientId, setClientId] = useState(creds?.clientId || '');
  const [clientSecret, setClientSecret] = useState('');
  const [tenant, setTenant] = useState(creds?.tenant || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setClientId(creds?.clientId || '');
    setTenant(creds?.tenant || '');
    setEditing(forceEditing || !creds);
  }, [creds, forceEditing]);

  const save = async () => {
    setErr(null); setBusy(true);
    try {
      await apiSetCalendarCredentials(provider, { clientId, clientSecret, tenant });
      setClientSecret('');
      setEditing(false);
      onSaved && onSaved();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!editing && creds) {
    return (
      <div className="bg-black/40 border border-white/5 rounded-md px-2.5 py-2 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-400 font-mono truncate" title={creds.clientId}>
            {creds.clientId.slice(0, 14)}…{creds.clientId.slice(-8)}
          </p>
          <p className="text-[10px] mt-0.5 flex items-center gap-2">
            <span className={`flex items-center gap-1 ${creds.hasSecret ? 'text-green-400' : 'text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${creds.hasSecret ? 'bg-green-400' : 'bg-amber-400'}`} />
              {creds.hasSecret ? tr({ fr: 'Secret configuré', en: 'Secret configured' }) : tr({ fr: 'Secret manquant', en: 'Secret missing' })}
            </span>
            {creds.tenant && creds.tenant !== 'common' && (
              <span className="text-slate-500 truncate">tenant {creds.tenant}</span>
            )}
          </p>
        </div>
        <GhostButton onClick={() => setEditing(true)}>{tr({ fr: 'Modifier', en: 'Edit' })}</GhostButton>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Field label="Client ID">
        <TextInput value={clientId} onChange={setClientId} placeholder={
          provider === 'google' ? 'xxxxxxxx.apps.googleusercontent.com' : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        } />
      </Field>
      <Field label={creds?.hasSecret ? 'Client Secret (vide = inchangé)' : 'Client Secret'}>
        <TextInput type="password" value={clientSecret} onChange={setClientSecret} placeholder="••••••••••" />
      </Field>
      {fields.includes('tenant') && (
        <Field label="Tenant" hint="« common » pour multi-tenant + comptes perso, ou l'ID Azure AD du studio">
          <TextInput value={tenant} onChange={setTenant} placeholder="common" />
        </Field>
      )}
      {err && <p className="text-[11px] text-red-300">{err}</p>}
      <div className="flex gap-2 justify-end pt-1">
        {creds && !forceEditing && <GhostButton onClick={() => setEditing(false)}>Annuler</GhostButton>}
        <PrimaryButton onClick={save} disabled={busy || !clientId || (!creds?.hasSecret && !clientSecret)}>
          {busy ? '…' : 'Enregistrer'}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ── Modal de configuration OAuth (Google / Microsoft) ──────────────────────
// Concentre instructions + URI redirect + formulaire dans un modal pour
// garder la card de provider compacte (no-scroll strict).
function OAuthConfigModal({ provider, fields, creds, onClose, onSaved }) {
  const tr = useTr();
  const providerLabel = provider === 'google' ? 'Google Calendar' : 'Microsoft 365 / Outlook';
  const consoleUrl = provider === 'google'
    ? 'https://console.cloud.google.com/apis/credentials'
    : 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade';
  const consoleLabel = provider === 'google' ? 'Google Cloud Console' : 'Azure AD App Registrations';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-xl p-5 max-w-lg w-full shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <ProviderLogo provider={provider} className="w-6 h-6" />
            <h3 className="text-sm font-semibold text-slate-100">{tr({ fr: 'Configurer', en: 'Configure' })} {providerLabel}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-200 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 6l12 12M6 18L18 6" strokeLinecap="round"/></svg>
          </button>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {provider === 'google' ? (
            tr({
              fr: <>Créez un projet sur <a className="text-blue-400 hover:underline" href={consoleUrl} target="_blank" rel="noreferrer">{consoleLabel}</a> → Identifiants → <strong className="text-slate-200">ID client OAuth 2.0</strong> (Application Web). Activez aussi l'API <strong className="text-slate-200">Google Calendar</strong> dans la bibliothèque.</>,
              en: <>Create a project on <a className="text-blue-400 hover:underline" href={consoleUrl} target="_blank" rel="noreferrer">{consoleLabel}</a> → Credentials → <strong className="text-slate-200">OAuth 2.0 Client ID</strong> (Web application). Also enable the <strong className="text-slate-200">Google Calendar</strong> API in the library.</>
            })
          ) : (
            tr({
              fr: <>Inscrivez une application sur <a className="text-blue-400 hover:underline" href={consoleUrl} target="_blank" rel="noreferrer">{consoleLabel}</a> (type Web). Permissions API déléguées : <strong className="text-slate-200">Calendars.Read, Calendars.Read.Shared, User.Read, offline_access</strong>.</>,
              en: <>Register an app on <a className="text-blue-400 hover:underline" href={consoleUrl} target="_blank" rel="noreferrer">{consoleLabel}</a> (Web type). Delegated API permissions: <strong className="text-slate-200">Calendars.Read, Calendars.Read.Shared, User.Read, offline_access</strong>.</>
            })
          )}
        </p>
        <RedirectUriBox provider={provider} />
        <CredentialsForm
          provider={provider} fields={fields} creds={creds}
          onSaved={() => { onSaved && onSaved(); onClose(); }}
          forceEditing
        />
      </div>
    </div>
  );
}

// ── Modal Apple CalDAV ─────────────────────────────────────────────────────
function AppleConnectModal({ onClose, onConnected }) {
  const tr = useTr();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const res = await apiConnectApple({ username, password, label: label || username });
      onConnected && onConnected(res);
      onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form onSubmit={submit}
        className="bg-slate-900 border border-white/10 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-3">
        <div className="flex items-center gap-2.5">
          <ProviderLogo provider="apple" className="w-6 h-6 text-slate-100" />
          <h3 className="text-sm font-semibold text-slate-100">{tr({ fr: 'Connecter un compte iCloud', en: 'Connect an iCloud account' })}</h3>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {tr({
            fr: <>Apple ne propose pas d'OAuth pour le calendrier. Utilisez votre Apple ID et un{' '}<span className="text-slate-200 font-semibold">mot de passe pour application</span> généré sur{' '}<a className="text-blue-400 hover:underline" href="https://account.apple.com/account/manage" target="_blank" rel="noreferrer">account.apple.com</a>{' '}(Sécurité → Mots de passe pour application).</>,
            en: <>Apple does not offer OAuth for calendars. Use your Apple ID and an{' '}<span className="text-slate-200 font-semibold">app-specific password</span> generated on{' '}<a className="text-blue-400 hover:underline" href="https://account.apple.com/account/manage" target="_blank" rel="noreferrer">account.apple.com</a>{' '}(Security → App-Specific Passwords).</>
          })}
        </p>
        <Field label={tr({ fr: 'Apple ID (email)', en: 'Apple ID (email)' })}>
          <TextInput type="email" value={username} onChange={setUsername} placeholder="prenom@icloud.com" autoFocus required />
        </Field>
        <Field label={tr({ fr: 'Mot de passe pour application', en: 'App-specific password' })} hint={tr({ fr: 'Format : xxxx-xxxx-xxxx-xxxx', en: 'Format: xxxx-xxxx-xxxx-xxxx' })}>
          <TextInput type="password" value={password} onChange={setPassword} placeholder="abcd-efgh-ijkl-mnop" required />
        </Field>
        <Field label={tr({ fr: 'Libellé (optionnel)', en: 'Label (optional)' })} hint={tr({ fr: 'Pour distinguer ce compte des autres', en: 'To distinguish this account from others' })}>
          <TextInput value={label} onChange={setLabel} placeholder={tr({ fr: 'iCloud — Régie', en: 'iCloud — Control room' })} />
        </Field>
        {err && <p className="text-[11px] text-red-300">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton type="button" onClick={onClose}>{tr({ fr: 'Annuler', en: 'Cancel' })}</GhostButton>
          <PrimaryButton type="submit" disabled={busy || !username || !password}>
            {busy ? tr({ fr: 'Connexion…', en: 'Connecting…' }) : tr({ fr: 'Connecter', en: 'Connect' })}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

// ── Account row — compact ──────────────────────────────────────────────────
function AccountRow({ account, onRemove, onRefresh, onRename, busy }) {
  const tr = useTr();
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(account.label || '');

  const save = () => {
    if (labelDraft && labelDraft !== account.label) onRename(account.id, labelDraft);
    setEditingLabel(false);
  };

  const lastSync = account.lastSyncAt ? new Date(account.lastSyncAt).toLocaleString() : 'jamais';
  const errMsg = account.lastError && account.lastError.message;

  return (
    <div className="bg-black/40 border border-white/5 rounded-md p-2.5 flex items-start gap-2.5">
      <ProviderLogo provider={account.provider} className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1">
        {editingLabel ? (
          <div className="flex gap-1.5">
            <TextInput value={labelDraft} onChange={setLabelDraft} autoFocus
              onKeyDown={e => e.key === 'Enter' && save()} />
            <GhostButton onClick={save}>OK</GhostButton>
          </div>
        ) : (
          <button onClick={() => { setLabelDraft(account.label || ''); setEditingLabel(true); }}
            className="text-left w-full bg-transparent border-0 p-0 hover:bg-slate-800/40 rounded transition-colors"
            title={tr({ fr: 'Renommer ce compte', en: 'Rename this account' })}>
            <p className="text-sm font-semibold text-slate-100 truncate">{account.label || account.accountEmail || account.id}</p>
            <p className="text-[10px] text-slate-500 truncate">{account.accountEmail}</p>
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
          <span>Sync : <span className="text-slate-300 font-mono">{lastSync}</span></span>
          {errMsg && <span className="text-red-300 truncate max-w-[200px]" title={errMsg}>· erreur : {errMsg}</span>}
        </div>
        {account.calendars && account.calendars.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {account.calendars.slice(0, 6).map(cal => (
              <span key={cal.id}
                className="inline-flex items-center gap-1.5 text-[10px] bg-slate-900/80 border border-white/5 rounded px-1.5 py-0.5 text-slate-300">
                <span className="w-2 h-2 rounded-full" style={{ background: cal.color }} />
                <span className="truncate max-w-[140px]">{cal.name}</span>
                {cal.primary && <span className="text-blue-400 text-[8px] uppercase">primaire</span>}
              </span>
            ))}
            {account.calendars.length > 6 && (
              <span className="text-[10px] text-slate-500 px-1">+{account.calendars.length - 6}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <GhostButton onClick={() => onRefresh(account.id)} disabled={busy} title="Rafraîchir la liste des calendriers">↻</GhostButton>
        <DangerButton onClick={() => onRemove(account.id)} disabled={busy} title="Déconnecter ce compte">✕</DangerButton>
      </div>
    </div>
  );
}

// ── ProviderSummary — vue compacte d'une card OAuth (Google/Microsoft) ─────
// Affiche un résumé du statut de la config + 2 boutons : "Configurer"
// (ouvre le modal complet) et "Connecter un compte" (lance le flow OAuth).
function ProviderSummary({ provider, creds, connectedCount, onConfigure, onConnect }) {
  const tr = useTr();
  return (
    <div className="flex flex-col gap-2.5 h-full">
      {creds?.hasSecret ? (
        <div className="bg-black/40 border border-white/5 rounded-md px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Client ID</p>
          <p className="text-xs text-slate-300 font-mono truncate" title={creds.clientId}>
            {creds.clientId}
          </p>
          {creds.tenant && creds.tenant !== 'common' && (
            <p className="text-[11px] text-slate-500 mt-1 font-mono">tenant : {creds.tenant}</p>
          )}
        </div>
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2.5">
          <p className="text-[11px] text-amber-200 leading-snug">
            {tr({ fr: 'Aucun credential OAuth enregistré. Configurez le client ID + secret pour activer la connexion.', en: 'No OAuth credentials saved. Configure the client ID + secret to enable connection.' })}
          </p>
        </div>
      )}
      <div className="flex gap-2 mt-auto">
        <GhostButton onClick={onConfigure}>
          {creds?.hasSecret ? tr({ fr: 'Modifier', en: 'Edit' }) : tr({ fr: 'Configurer', en: 'Configure' })}
        </GhostButton>
        <button onClick={onConnect} disabled={!creds?.hasSecret}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800/40 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs rounded font-medium transition-colors flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M21 14v7H3V3h7"/>
          </svg>
          {tr({ fr: 'Connecter', en: 'Connect' })}
          {connectedCount > 0 && (
            <span className="text-[10px] bg-blue-700/60 px-1.5 py-0.5 rounded">{connectedCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}


// ── Mini badge stats par provider (rendu dans le hero) ──────────────────────
function ProviderStat({ provider, count, label }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-black/40 border border-white/5 rounded-lg">
      <ProviderLogo provider={provider} className="w-5 h-5" />
      <div className="leading-tight">
        <p className="text-2xl font-mono font-bold text-slate-100 tabular-nums">{count}</p>
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</p>
      </div>
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────

export default function CalendarsPanel() {
  const dialog = useDialog();
  const tr = useTr();
  const [creds, setCreds] = useState({ google: null, microsoft: null });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [showAppleModal, setShowAppleModal] = useState(false);
  // Modal de configuration OAuth (Google/Microsoft) — null ou { provider, fields }
  const [configModal, setConfigModal] = useState(null);
  const [toast, setToast] = useState(null);
  const popupRef = useRef(null);

  const refresh = async () => {
    try {
      const [c, a] = await Promise.all([apiGetCalendarCredentials(), apiListCalendarAccounts()]);
      setCreds(c);
      setAccounts(a);
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const onAccountsChanged = () => refresh();
    const onCredsChanged = () => refresh();
    socket.on('calendarAccountsChanged', onAccountsChanged);
    socket.on('calendarCredentialsChanged', onCredsChanged);
    return () => {
      socket.off('calendarAccountsChanged', onAccountsChanged);
      socket.off('calendarCredentialsChanged', onCredsChanged);
    };
  }, []);

  useEffect(() => {
    const onMsg = (ev) => {
      if (!ev.data || typeof ev.data !== 'object') return;
      if (ev.data.type === 'oauth-success') {
        setToast({ type: 'success', msg: `Compte ${ev.data.provider} connecté !` });
        refresh();
      } else if (ev.data.type === 'oauth-error') {
        setToast({ type: 'error', msg: `Échec connexion ${ev.data.provider}` });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openOAuth = async (provider) => {
    try {
      const fn = provider === 'google' ? apiAuthorizeGoogle : apiAuthorizeMicrosoft;
      const { url } = await fn();
      const w = window.open(url, 'oauth-' + provider, 'width=540,height=700');
      popupRef.current = w;
    } catch (e) {
      setToast({ type: 'error', msg: e.message });
    }
  };

  const removeAccount = async (id) => {
    const ok = await dialog.confirm({
      title: 'Déconnecter ce compte ?',
      message: "Les templates qui l'utilisent ne pourront plus afficher leurs événements.",
      confirmLabel: 'Déconnecter',
      danger: true
    });
    if (!ok) return;
    setBusyId(id);
    try { await apiDeleteCalendarAccount(id); await refresh(); }
    catch (e) { setToast({ type: 'error', msg: e.message }); }
    finally { setBusyId(null); }
  };

  const refreshAccount = async (id) => {
    setBusyId(id);
    try { await apiRefreshCalendarAccount(id); await refresh(); }
    catch (e) { setToast({ type: 'error', msg: e.message }); }
    finally { setBusyId(null); }
  };

  const renameAccount = async (id, label) => {
    try { await apiRenameCalendarAccount(id, label); await refresh(); }
    catch (e) { setToast({ type: 'error', msg: e.message }); }
  };

  if (loading) return <div className="p-6 text-slate-400">Chargement…</div>;

  const googleCount = accounts.filter(a => a.provider === 'google').length;
  const microsoftCount = accounts.filter(a => a.provider === 'microsoft').length;
  const appleCount = accounts.filter(a => a.provider === 'apple').length;

  return (
    <div className="h-full overflow-hidden bg-ink p-3 flex flex-col gap-3 text-slate-200">

      {/* ─────────── HERO — bandeau identité Calendriers + stats par provider ─────────── */}
      <header className="flex-shrink-0 relative bg-slate-950/60 border border-white/5 rounded-xl px-5 py-4 flex items-stretch gap-5">
        {/* Cellule icône */}
        <div className="w-24 h-24 bg-black border border-white/10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
          <svg className="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <path d="M8 14h2v2H8zM12 14h2v2h-2zM16 14h2v2h-2z"/>
          </svg>
        </div>

        {/* Titre + résumé */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-400/80 font-semibold">{tr({ fr: 'SOURCES·CALENDRIER', en: 'CALENDAR·SOURCES' })}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/30 via-white/5 to-transparent" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">{tr({ fr: 'Calendriers connectés', en: 'Connected calendars' })}</h1>
          <p className="text-[11px] text-slate-500 tracking-wide">
            {accounts.length === 0
              ? tr({ fr: 'Aucun compte connecté pour le moment.', en: 'No connected accounts yet.' })
              : tr({
                  fr: `${accounts.length} compte${accounts.length > 1 ? 's' : ''} synchronisé${accounts.length > 1 ? 's' : ''} sur ${[creds.google?.hasSecret, creds.microsoft?.hasSecret].filter(Boolean).length + (appleCount > 0 ? 1 : 0)} provider${(creds.google?.hasSecret || creds.microsoft?.hasSecret || appleCount > 0) ? 's' : ''}`,
                  en: `${accounts.length} account${accounts.length > 1 ? 's' : ''} synced across ${[creds.google?.hasSecret, creds.microsoft?.hasSecret].filter(Boolean).length + (appleCount > 0 ? 1 : 0)} provider${(creds.google?.hasSecret || creds.microsoft?.hasSecret || appleCount > 0) ? 's' : ''}`
                })}
          </p>
        </div>

        {/* Stats par provider — readouts mono comme le cluster heures de SettingsPanel */}
        <div className="flex flex-col justify-center gap-1.5 pl-6 border-l border-white/10 flex-shrink-0">
          <div className="flex gap-2">
            <ProviderStat provider="google" count={googleCount} label="Google" />
            <ProviderStat provider="microsoft" count={microsoftCount} label="Microsoft" />
            <ProviderStat provider="apple" count={appleCount} label="Apple" />
          </div>
        </div>
      </header>

      {/* ─────────── GRILLE — 12 cols, 2 rows STRICTEMENT égales ─────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 [grid-template-rows:1fr_1fr] auto-rows-fr">

        {/* ROW 1 */}
        {/* GOOGLE — col-span-6, vue résumé compacte (config détaillée → modal) */}
        <Card icon={Icons.google} title="Google Calendar" className="col-span-6"
          headerRight={
            <span className={`text-[10px] uppercase tracking-wider font-semibold flex items-center ${creds.google?.hasSecret ? 'text-green-300' : 'text-amber-300'}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${creds.google?.hasSecret ? 'bg-green-400' : 'bg-amber-400'}`} />
              {creds.google?.hasSecret ? tr({ fr: 'Configuré', en: 'Configured' }) : tr({ fr: 'Non configuré', en: 'Not configured' })}
            </span>
          }>
          <ProviderSummary
            provider="google"
            creds={creds.google}
            connectedCount={googleCount}
            onConfigure={() => setConfigModal({ provider: 'google', fields: [] })}
            onConnect={() => openOAuth('google')}
          />
        </Card>

        {/* MICROSOFT — col-span-6, idem */}
        <Card icon={Icons.microsoft} title="Microsoft 365 / Outlook" className="col-span-6"
          headerRight={
            <span className={`text-[10px] uppercase tracking-wider font-semibold flex items-center ${creds.microsoft?.hasSecret ? 'text-green-300' : 'text-amber-300'}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${creds.microsoft?.hasSecret ? 'bg-green-400' : 'bg-amber-400'}`} />
              {creds.microsoft?.hasSecret ? tr({ fr: 'Configuré', en: 'Configured' }) : tr({ fr: 'Non configuré', en: 'Not configured' })}
            </span>
          }>
          <ProviderSummary
            provider="microsoft"
            creds={creds.microsoft}
            connectedCount={microsoftCount}
            onConfigure={() => setConfigModal({ provider: 'microsoft', fields: ['tenant'] })}
            onConnect={() => openOAuth('microsoft')}
          />
        </Card>

        {/* ROW 2 */}
        {/* COMPTES CONNECTÉS — col-span-12 (largeur totale) */}
        <Card
          icon={Icons.users}
          title={tr({ fr: 'Comptes connectés', en: 'Connected accounts' })}
          className="col-span-12"
          headerRight={
            <button onClick={() => setShowAppleModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium transition-colors flex items-center gap-1.5">
              <ProviderLogo provider="apple" className="w-3.5 h-3.5" />
              {tr({ fr: 'Ajouter Apple', en: 'Add Apple' })}
            </button>
          }>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="flex gap-2 mb-3 opacity-30">
                <ProviderLogo provider="google" className="w-6 h-6" />
                <ProviderLogo provider="microsoft" className="w-6 h-6" />
                <ProviderLogo provider="apple" className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-[12px] text-slate-500 leading-relaxed max-w-[400px]">
                {tr({
                  fr: <>Aucun compte connecté. Configurez d'abord les credentials Google ou Microsoft (cards ci-dessus) puis cliquez sur <strong className="text-slate-300">Connecter</strong>. Pour iCloud, utilisez <strong className="text-slate-300">Ajouter Apple</strong>.</>,
                  en: <>No connected accounts. First configure Google or Microsoft credentials (cards above) then click <strong className="text-slate-300">Connect</strong>. For iCloud, use <strong className="text-slate-300">Add Apple</strong>.</>
                })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 content-start">
              {accounts.map(acc => (
                <AccountRow key={acc.id} account={acc}
                  busy={busyId === acc.id}
                  onRemove={removeAccount}
                  onRefresh={refreshAccount}
                  onRename={renameAccount} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {showAppleModal && <AppleConnectModal onClose={() => setShowAppleModal(false)} onConnected={() => refresh()} />}

      {configModal && (
        <OAuthConfigModal
          provider={configModal.provider}
          fields={configModal.fields}
          creds={creds[configModal.provider]}
          onClose={() => setConfigModal(null)}
          onSaved={refresh}
        />
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-md border text-sm shadow-lg backdrop-blur-md ${
          toast.type === 'error' ? 'bg-red-900/40 border-red-500/40 text-red-200' :
          'bg-green-900/40 border-green-500/40 text-green-200'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}
