import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Cleanup du cache-bust query param utilisé après un update OTA.
// UpdatePanel ajoute `?_cb=<ts>` à l'URL pour forcer le browser à fetcher
// le nouvel index.html. Une fois le bundle chargé, on retire ce param pour
// garder une URL propre.
if (window.location.search.includes('_cb=')) {
  const url = new URL(window.location.href);
  url.searchParams.delete('_cb');
  window.history.replaceState({}, '', url.toString());
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
