import React, { useState, useEffect } from 'react';
import { socket } from '../socket';

export default function Help({ isOpen, onClose }) {
  const [serverInfo, setServerInfo] = useState({
    ip: 'localhost',
    port: '3333'
  });

  useEffect(() => {
    if (isOpen) {
      // Récupérer l'IP et le port du serveur
      const currentHost = window.location.hostname;
      const currentPort = window.location.port || '3333';
      setServerInfo({
        ip: currentHost,
        port: currentPort
      });
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div 
        className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl p-8 max-w-8xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white">Aide - API REST</h3>
          <p className="text-gray-400">Configuration pour StreamDeck et Companion/Buttons</p>
        </div>

        {/* Informations de connexion */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-medium text-blue-400 mb-2">Informations de connexion</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-300">Adresse IP :</span>
              <code className="block bg-gray-800 px-2 py-1 rounded text-blue-400 mt-1">{serverInfo.ip}</code>
            </div>
            <div>
              <span className="text-gray-300">Port :</span>
              <code className="block bg-gray-800 px-2 py-1 rounded text-green-400 mt-1">{serverInfo.port}</code>
            </div>
          </div>
        </div>

        {/* API REST */}
        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9" />
              </svg>
              API REST
            </h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-green-400 mb-2">Informations</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">État complet</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-blue-400">GET /api/timer/state</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Statut simple</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-blue-400">GET /api/timer/status</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Temps restant</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-blue-400">GET /api/timer/remaining</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Préférences</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-blue-400">GET /api/timer/display</code>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-green-400 mb-2">Contrôle Timer</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Démarrer</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-green-400">POST /api/timer/start</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Arrêter</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-red-400">POST /api/timer/stop</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Pause</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-yellow-400">POST /api/timer/pause</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Reprendre</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-green-400">POST /api/timer/resume</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Réinitialiser</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-gray-400">POST /api/timer/reset</code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-green-400 mb-2">Configuration Timer</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Définir durée</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-blue-400">POST /api/timer/set</code>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      Body: <code className="bg-gray-800 px-1 py-0.5 rounded">&#123;"duration": "00:12:00"&#125;</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Incrémenter chiffre</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-purple-400">POST /api/timer/digit/increment</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Décrémenter chiffre</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-purple-400">POST /api/timer/digit/decrement</code>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      Body: <code className="bg-gray-800 px-1 py-0.5 rounded">&#123;"position": 0&#125;</code> (0-5)
                    </div>
                  </div>
                </div>

                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-green-400 mb-2">Contrôle ON AIR</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Allumer</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-red-400">POST /api/onair/on</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Éteindre</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-gray-400">POST /api/onair/off</code>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-green-400 mb-2">Affichage</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Mode 2 horloges</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-blue-400">POST /api/display/mode</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Mode 3 horloges</span>
                      <code className="bg-gray-800 px-2 py-1 rounded text-blue-400">POST /api/display/mode</code>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      Body: <code className="bg-gray-800 px-1 py-0.5 rounded">&#123;"mode": "two"&#125;</code> ou <code className="bg-gray-800 px-1 py-0.5 rounded">&#123;"mode": "three"&#125;</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration StreamDeck */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0020.75 3H3.75A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            Configuration StreamDeck
          </h4>
          
          <div className="bg-gray-700/30 rounded-lg p-4">
            <h5 className="text-sm font-medium text-purple-400 mb-2">Plugin HTTP Request</h5>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-300">URL :</span>
                <code className="block bg-gray-800 px-2 py-1 rounded text-blue-400 mt-1">http://{serverInfo.ip}:{serverInfo.port}/api/timer/start</code>
              </div>
              <div>
                <span className="text-gray-300">Méthode :</span>
                <code className="bg-gray-800 px-2 py-1 rounded text-green-400 ml-2">POST</code>
              </div>
              <div>
                <span className="text-gray-300">Headers :</span>
                <code className="block bg-gray-800 px-2 py-1 rounded text-yellow-400 mt-1">Content-Type: application/json</code>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Remplacez <code className="bg-gray-800 px-1 py-0.5 rounded">/api/timer/start</code> par la commande souhaitée
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Companion */}
        <div className="mt-6">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-orange-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082m-.75-.082a24.301 24.301 0 00-4.5 0m0 0v5.714a2.25 2.25 0 00-.659 1.591L5 14.5m0-11.396a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 01-.659 1.591L5 14.5" />
            </svg>
            Configuration Companion/Buttons
          </h4>
          
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4">
            <div className="text-sm text-orange-400 font-medium mb-2">⚠️ Module Generic HTTP</div>
            <div className="text-xs text-gray-300">
              Utilisez le module <strong>Generic HTTP</strong> de Companion/Buttons. Ce module est conçu pour les applications personnalisées comme OnAir Studio Timer.
            </div>
          </div>
          
          <div className="bg-gray-700/30 rounded-lg p-4">
            <h5 className="text-sm font-medium text-orange-400 mb-3">Configuration exacte (basée sur l'image) :</h5>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-300">Delay :</span>
                  <code className="block bg-gray-800 px-2 py-1 rounded text-blue-400 mt-1">0 ms</code>
                </div>
                <div>
                  <span className="text-gray-300">URI :</span>
                  <code className="block bg-gray-800 px-2 py-1 rounded text-green-400 mt-1">/api/timer/pause</code>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-300">Body :</span>
                  <code className="block bg-gray-800 px-2 py-1 rounded text-purple-400 mt-1">Text</code>
                </div>
                <div>
                  <span className="text-gray-300">Header input (JSON) :</span>
                  <code className="block bg-gray-800 px-2 py-1 rounded text-yellow-400 mt-1">&#123;&#125;</code>
                </div>
              </div>
              
              <div>
                <span className="text-gray-300">Content Type :</span>
                <code className="block bg-gray-800 px-2 py-1 rounded text-red-400 mt-1">&#123;"Content-Type": "application/json"&#125;</code>
              </div>
              
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mt-4">
                <div className="text-sm text-green-400 font-medium mb-2">✅ Configuration validée</div>
                <div className="text-xs text-gray-300">
                  Cette configuration fonctionne parfaitement avec Companion/Buttons. Remplacez simplement <code className="bg-gray-800 px-1 py-0.5 rounded">/api/timer/pause</code> par la commande souhaitée dans la liste ci-dessus.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bouton de fermeture */}
        <div className="flex justify-end mt-8 pt-6 border-t border-gray-700">
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}