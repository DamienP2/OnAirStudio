import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../hooks/useT';

const LockIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="11" width="14" height="10" rx="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

const TABS = [
  { key: 'control',   i18nKey: 'tab.control',   path: '/control',   gated: false },
  { key: 'design',    i18nKey: 'tab.design',    path: '/design',    gated: true  },
  { key: 'calendars', i18nKey: 'tab.calendars', path: '/calendars', gated: true  },
  { key: 'settings',  i18nKey: 'tab.settings',  path: '/settings',  gated: true  },
  { key: 'help',      i18nKey: 'tab.help',      path: '/help',      gated: false },
];

export default function TabBar({ active }) {
  const t = useT();
  return (
    <nav className="flex-shrink-0 h-11 bg-slate-950/60 border-b border-white/5 px-6 flex items-stretch">
      {TABS.map(tab => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            to={tab.path}
            className={`flex items-center gap-1.5 px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] transition-all border-b-2 -mb-px ${
              isActive
                ? 'text-slate-50 border-blue-500'
                : 'text-slate-500 hover:text-slate-300 border-transparent'
            }`}
          >
            {t(tab.i18nKey)}
            {tab.gated && (
              <span className="text-slate-600">
                <LockIcon />
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
