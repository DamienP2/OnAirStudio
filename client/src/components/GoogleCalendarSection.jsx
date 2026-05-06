import React, { useEffect, useState } from 'react';
import {
  apiCalendarStatus, apiCalendarConfig, apiCalendarOAuthStart,
  apiCalendarDisconnect, apiCalendarList
} from '../store/templateStore';

export default function GoogleCalendarSection({ onShowToast }) {
  const [status, setStatus] = useState(null);
  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const s = await apiCalendarStatus();
      setStatus(s);
      setClientId(s.clientId || '');
      if (s.connected) {
        try {
          const { calendars } = await apiCalendarList();
          setCalendars(calendars);
        } catch (e) {
          setCalendars([]);
          onShowToast?.('Impossible de lister les agendas : ' + e.message, 'error');
        }
      } else {
        setCalendars([]);
      }
    } catch (e) {
      onShowToast?.('Erreur statut Google Calendar : ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleSaveCreds = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      onShowToast?.('clientId et clientSecret requis', 'error');
      return;
    }
    setBusy(true);
    try {
      await apiCalendarConfig({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
      setClientSecret('');
      onShowToast?.('Identifiants OAuth enregistrés — clique sur « Connecter à Google »', 'success');
      await refresh();
    } catch (e) {
      onShowToast?.('Erreur : ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async () => {
    setBusy(true);
    try {
      const { authUrl } = await apiCalendarOAuthStart();
      // Ouvre dans un nouvel onglet — Google redirigera vers /api/calendar/oauth/callback
      const popup = window.open(authUrl, '_blank', 'noopener,noreferrer');
      if (!popup) {
        onShowToast?.('Pop-up bloquée — autorise les pop-ups pour ce site', 'error');
      } else {
        onShowToast?.('Fenêtre Google ouverte — autorise puis reviens ici et clique sur « Actualiser »', 'info');
      }
    } catch (e) {
      onShowToast?.('Erreur : ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Déconnecter ce compte Google ?')) return;
    setBusy(true);
    try {
      await apiCalendarDisconnect();
      onShowToast?.('Compte Google déconnecté', 'info');
      await refresh();
    } catch (e) {
      onShowToast?.('Erreur : ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400 text-sm">Chargement…</div>;
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Google Calendar
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Utilisé par l'objet « Planning » du designer pour afficher les tournages du jour sur le display.
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
        >Actualiser</button>
      </div>

      {/* URI de redirection — à déclarer dans Google Cloud Console */}
      <div className="bg-slate-950/60 border border-white/5 rounded-md p-3 mb-4">
        <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1">URI de redirection autorisée</p>
        <code className="text-xs text-slate-300 font-mono break-all select-all">{status?.redirectUri || ''}</code>
        <p className="text-[11px] text-slate-500 mt-1">
          Ajoute exactement cette URI dans ta configuration OAuth Google Cloud Console
          (« Authorized redirect URIs ») avant de connecter.
        </p>
      </div>

      {/* Identifiants OAuth */}
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Identifiants OAuth (type « Web application »)</p>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Client ID"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-md text-sm text-slate-100 outline-none focus:border-blue-500 transition-colors"
          />
          <input
            type="password"
            placeholder={status?.configured ? 'Client Secret (saisir pour modifier)' : 'Client Secret'}
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-md text-sm text-slate-100 outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={handleSaveCreds}
            disabled={busy || !clientId.trim() || !clientSecret.trim()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm text-slate-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >Enregistrer les identifiants</button>
        </div>
      </div>

      {/* État de connexion */}
      <div className="mb-2 flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${status?.connected ? 'bg-green-500' : 'bg-slate-600'}`} />
        <span className="text-sm text-slate-300">
          {status?.connected
            ? <>Connecté : <span className="font-mono text-slate-100">{status.accountEmail || '(email inconnu)'}</span></>
            : status?.configured ? 'Identifiants enregistrés — pas encore connecté' : 'Non configuré'}
        </span>
      </div>

      {/* Actions connecté / pas encore connecté */}
      <div className="flex gap-2">
        {status?.configured && !status?.connected && (
          <button
            onClick={handleConnect}
            disabled={busy}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md transition-colors disabled:opacity-40"
          >Connecter à Google</button>
        )}
        {status?.connected && (
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm rounded-md transition-colors disabled:opacity-40"
          >Déconnecter</button>
        )}
      </div>

      {/* Liste des agendas — info pour vérifier que la connexion fonctionne */}
      {status?.connected && calendars.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
            Agendas accessibles ({calendars.length})
          </p>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {calendars.map(c => (
              <li key={c.id} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.backgroundColor }} />
                <span className="text-slate-200">{c.summary}</span>
                {c.primary && <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">principal</span>}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 mt-2">
            Le choix de l'agenda et de la couleur se fait ensuite dans l'inspector du designer, par planning-object.
          </p>
        </div>
      )}
    </div>
  );
}
