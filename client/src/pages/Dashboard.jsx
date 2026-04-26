import React from 'react';
import Header from '../components/Header';
import TabBar from '../components/TabBar';
import AdminAuthGate from '../components/AdminAuthGate';
import DocumentTitle from '../components/DocumentTitle';
import UpdateSuccessModal from '../components/UpdateSuccessModal';
import { TimerProvider } from '../store/TimerContext';
import { PaletteProvider } from '../store/PaletteContext';
import ControlPanel from '../panels/ControlPanel';
import DesignPanel from '../panels/DesignPanel';
import SettingsPanel from '../panels/SettingsPanel';
import CalendarsPanel from '../panels/CalendarsPanel';
import HelpPanel from '../panels/HelpPanel';

const GATED = new Set(['design', 'settings', 'calendars']);

const TAB_LABELS = {
  control:   'Contrôle',
  design:    'Design',
  calendars: 'Calendriers',
  settings:  'Réglages',
  help:      'Aide'
};

export default function Dashboard({ activeTab }) {
  const panel = (() => {
    switch (activeTab) {
      case 'control':   return <ControlPanel />;
      case 'design':    return <DesignPanel />;
      case 'calendars': return <CalendarsPanel />;
      case 'settings':  return <SettingsPanel />;
      case 'help':      return <HelpPanel />;
      default:          return <ControlPanel />;
    }
  })();

  const wrapped = GATED.has(activeTab) ? <AdminAuthGate>{panel}</AdminAuthGate> : panel;

  return (
    <TimerProvider>
      <PaletteProvider>
        <DocumentTitle page={TAB_LABELS[activeTab] || 'Contrôle'} />
        <div className="h-screen overflow-hidden bg-ink text-slate-50 flex flex-col font-sans">
          <Header />
          <TabBar active={activeTab} />
          <main className="flex-1 min-h-0 overflow-hidden">{wrapped}</main>
          {/* Modal post-reload : si l'app vient de se mettre à jour, on confirme
              au user que tout s'est bien passé. Détecte via localStorage et
              compare la version pré-update avec la version courante. */}
          <UpdateSuccessModal />
        </div>
      </PaletteProvider>
    </TimerProvider>
  );
}
