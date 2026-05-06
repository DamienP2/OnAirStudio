import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import Toast from '../components/Toast';
import UpdatePanel from '../components/UpdatePanel';

export default function Settings({ isOpen, onClose }) {
  const [settings, setSettings] = useState({
    ntpServer: '',
    studioName: '',
    defaultDisplayMode: 'two',
    colors: {
      current: '#FFFFFF',
      elapsed: '#3B82F6',
      remaining: '#EF4444'
    },
    presetTimes: []
  });
  const [originalSettings, setOriginalSettings] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const [newPreset, setNewPreset] = useState({ label: '', value: '' });
  const [defaultSettings, setDefaultSettings] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [adminPasswordForUpdate, setAdminPasswordForUpdate] = useState('');
  const [timerIsRunning, setTimerIsRunning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Charger les paramètres actuels depuis le serveur
      socket.emit('requestSettings');
      socket.emit('requestDefaultSettings');
      
      socket.on('settingsUpdate', (serverSettings) => {
        setSettings(serverSettings);
        setOriginalSettings(serverSettings);
        setHasChanges(false);
      });

      socket.on('defaultSettingsUpdate', (defaults) => {
        setDefaultSettings(defaults);
      });

      return () => {
        socket.off('settingsUpdate');
        socket.off('defaultSettingsUpdate');
      };
    } else {
      // Vider les toasts quand le modal se ferme
      setToasts([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (state) => setTimerIsRunning(!!state.isRunning);
    socket.on('timerUpdate', handler);
    socket.emit('requestState');
    return () => socket.off('timerUpdate', handler);
  }, []);

  const handleClose = () => {
    onClose();
  };

  // Fonction pour gérer les changements de paramètres
  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
    setHasChanges(true);
  };

  // Fonction pour sauvegarder les paramètres
  const handleSave = () => {
    socket.emit('updateSettings', settings);
    setOriginalSettings(settings);
    setHasChanges(false);
    showToast('Paramètres sauvegardés avec succès', 'success');
  };

  // Fonction pour annuler les changements et fermer le modal
  const handleCancel = () => {
    if (hasChanges) {
      if (originalSettings) {
        setSettings(originalSettings);
        setHasChanges(false);
        showToast('Modifications annulées', 'info');
      }
    }
    handleClose();
  };

  // Fonction pour convertir les minutes en format HH:MM:SS
  const minutesToTimeFormat = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
  };

  // Fonction pour convertir le format HH:MM:SS en minutes
  const timeFormatToMinutes = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Fonction pour ajuster un chiffre spécifique des minutes
  const adjustMinutesDigit = (position, increment) => {
    const currentMinutes = parseInt(newPreset.value) || 0;
    const minutesStr = String(currentMinutes).padStart(3, '0');
    const digits = minutesStr.split('').map(Number);
    
    // Appliquer les limites selon la position
    if (position === 0) { // Centaines (0-9)
      digits[position] = (digits[position] + increment + 10) % 10;
    } else if (position === 1) { // Dizaines (0-9)
      digits[position] = (digits[position] + increment + 10) % 10;
    } else if (position === 2) { // Unités (0-9)
      digits[position] = (digits[position] + increment + 10) % 10;
    }
    
    const newMinutes = parseInt(digits.join(''));
    setNewPreset(prev => ({ ...prev, value: newMinutes.toString() }));
  };

  // Fonction pour sauvegarder immédiatement (pour les actions critiques)
  const saveImmediately = (newSettings, message) => {
    setIsSaving(true);
    setHasChanges(false);
    setSettings(newSettings);
    socket.emit('updateSettings', newSettings);
    showToastWithDelay(message, 'success');
    // Réactiver la sauvegarde automatique après un court délai
    setTimeout(() => setIsSaving(false), 2000);
  };

  const addPreset = () => {
    if (newPreset.value) {
      const minutes = parseInt(newPreset.value);
      const timeValue = minutesToTimeFormat(minutes);
      const label = `${minutes} min`;
      const newSettings = {
        ...settings,
        presetTimes: [...settings.presetTimes, { label: label, value: timeValue }]
      };
      handleSettingsChange(newSettings);
      setNewPreset({ label: '', value: '' });
    }
  };

  const removePreset = (index) => {
    const newSettings = {
      ...settings,
      presetTimes: settings.presetTimes.filter((_, i) => i !== index)
    };
    handleSettingsChange(newSettings);
  };

  const updatePreset = (index, field, value) => {
    const newSettings = {
      ...settings,
      presetTimes: settings.presetTimes.map((preset, i) => 
        i === index ? { ...preset, [field]: value } : preset
      )
    };
    handleSettingsChange(newSettings);
  };

  // Fonction pour gérer le changement de couleur avec fermeture automatique
  const handleColorChange = (colorType, value) => {
    const newSettings = {
      ...settings,
      colors: { ...settings.colors, [colorType]: value }
    };
    handleSettingsChange(newSettings);
  };

  // Fonction pour fermer le picker de couleur
  const handleColorInput = (colorType, e) => {
    const newSettings = {
      ...settings,
      colors: { ...settings.colors, [colorType]: e.target.value }
    };
    handleSettingsChange(newSettings);
  };

  // Fonction pour gérer les touches clavier sur les inputs de couleur
  const handleColorKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.target.blur();
    }
  };

  // Fonction pour afficher une notification en mode stack
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    const newToast = { id, message, type, isVisible: true };
    
    setToasts(prev => [...prev, newToast]);
    
    // Fermer automatiquement après 3 secondes
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  };

  // Fonction pour supprimer un toast
  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Fonction pour remettre les valeurs par défaut
  const resetToDefaults = () => {
    if (defaultSettings) {
      setSettings(defaultSettings);
      setHasChanges(true);
      showToast('Valeurs par défaut appliquées - Cliquez sur "Enregistrer" pour sauvegarder', 'info');
    }
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-white">Paramètres</h3>
            <button
              onClick={resetToDefaults}
              disabled={!defaultSettings}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Valeurs par défaut
            </button>
          </div>
          <p className="text-gray-400">Configurez les paramètres de l'application</p>
        </div>

        {/* Grille à 2 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Colonne gauche */}
          <div className="space-y-6">
            {/* Serveur NTP */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Adresse serveur NTP
              </label>
                          <input
              type="text"
              value={settings.ntpServer}
              onChange={(e) => handleSettingsChange({ ...settings, ntpServer: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="delphi.phys.univ-tours.fr"
            />
            </div>

            {/* Nom du studio */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom du studio
              </label>
                          <input
              type="text"
              value={settings.studioName}
              onChange={(e) => handleSettingsChange({ ...settings, studioName: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Studio 2"
            />
            </div>

                        {/* Mode d'affichage par défaut */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mode d'affichage par défaut
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSettingsChange({ ...settings, defaultDisplayMode: 'two' })}
                  className={`relative flex flex-col items-center justify-center py-4 px-6 rounded-lg transition-colors ${
                    settings.defaultDisplayMode === 'two'
                      ? 'bg-gray-700 border-2 border-blue-500'
                      : 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {settings.defaultDisplayMode === 'two' && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                    <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  </div>
                  <span className="text-xs text-gray-400">2 Horloges</span>
                </button>

                <button
                  onClick={() => handleSettingsChange({ ...settings, defaultDisplayMode: 'three' })}
                  className={`relative flex flex-col items-center justify-center py-4 px-6 rounded-lg transition-colors ${
                    settings.defaultDisplayMode === 'three'
                      ? 'bg-gray-700 border-2 border-blue-500'
                      : 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {settings.defaultDisplayMode === 'three' && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center space-y-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                      <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">3 Horloges</span>
                </button>
              </div>
            </div>

            {/* Couleurs */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Couleurs
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Heure actuelle</label>
                  <input
                    type="color"
                    value={settings.colors.current}
                    onInput={(e) => handleColorInput('current', e)}
                    onKeyDown={handleColorKeyDown}
                    className="w-full h-8 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Temps écoulé</label>
                  <input
                    type="color"
                    value={settings.colors.elapsed}
                    onInput={(e) => handleColorInput('elapsed', e)}
                    onKeyDown={handleColorKeyDown}
                    className="w-full h-8 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Temps restant</label>
                  <input
                    type="color"
                    value={settings.colors.remaining}
                    onInput={(e) => handleColorInput('remaining', e)}
                    onKeyDown={handleColorKeyDown}
                    className="w-full h-8 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Colonne droite */}
          <div>
            {/* Temps prédéfinis */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Temps prédéfinis
              </label>
              <div className="space-y-3">
                {settings.presetTimes.map((preset, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                      {preset.label}
                    </div>
                    <div className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono">
                      {preset.value}
                    </div>
                    <button
                      onClick={() => removePreset(index)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                
                {/* Ajouter un nouveau preset */}
                <div className="flex items-center gap-3 pt-2 border-t border-gray-600">
                  <div className="flex items-center gap-2 flex-1">
                    {/* Réglage manuel des minutes */}
                    <div className="flex items-center gap-1">
                      {/* Centaines */}
                      <div className="flex flex-col items-center">
                        <button 
                          onClick={() => adjustMinutesDigit(0, 1)}
                          className="p-1 rounded transition-colors focus:outline-none bg-gray-600 hover:bg-gray-700 text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                        <div className="text-2xl font-mono font-bold text-white w-8 text-center">
                          {String(parseInt(newPreset.value) || 0).padStart(3, '0')[0]}
                        </div>
                        <button 
                          onClick={() => adjustMinutesDigit(0, -1)}
                          className="p-1 rounded transition-colors focus:outline-none bg-gray-600 hover:bg-gray-700 text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Dizaines */}
                      <div className="flex flex-col items-center">
                        <button 
                          onClick={() => adjustMinutesDigit(1, 1)}
                          className="p-1 rounded transition-colors focus:outline-none bg-gray-600 hover:bg-gray-700 text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                        <div className="text-2xl font-mono font-bold text-white w-8 text-center">
                          {String(parseInt(newPreset.value) || 0).padStart(3, '0')[1]}
                        </div>
                        <button 
                          onClick={() => adjustMinutesDigit(1, -1)}
                          className="p-1 rounded transition-colors focus:outline-none bg-gray-600 hover:bg-gray-700 text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Unités */}
                      <div className="flex flex-col items-center">
                        <button 
                          onClick={() => adjustMinutesDigit(2, 1)}
                          className="p-1 rounded transition-colors focus:outline-none bg-gray-600 hover:bg-gray-700 text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                        <div className="text-2xl font-mono font-bold text-white w-8 text-center">
                          {String(parseInt(newPreset.value) || 0).padStart(3, '0')[2]}
                        </div>
                        <button 
                          onClick={() => adjustMinutesDigit(2, -1)}
                          className="p-1 rounded transition-colors focus:outline-none bg-gray-600 hover:bg-gray-700 text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <span className="text-gray-400 text-sm">min</span>
                  </div>
                  <button
                    onClick={addPreset}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Mise à jour */}
        <div className="border-t border-gray-700 pt-6 mt-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Mot de passe admin (pour la mise à jour)
            </label>
            <input
              type="password"
              value={adminPasswordForUpdate}
              onChange={(e) => setAdminPasswordForUpdate(e.target.value)}
              placeholder="Requis pour vérifier/appliquer une mise à jour"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <UpdatePanel
            adminPassword={adminPasswordForUpdate}
            timerIsRunning={timerIsRunning}
            onShowToast={showToast}
          />
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-700">
          <button
            onClick={handleCancel}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            {hasChanges ? 'Annuler' : 'Fermer'}
          </button>
          
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`px-6 py-3 rounded-lg transition-colors ${
              !hasChanges
                ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            Enregistrer
          </button>
        </div>

      </div>

      {/* Notifications Toast en mode stack */}
      <div className="fixed top-4 left-4 z-60 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-md p-4 rounded-lg shadow-lg border-l-4 transform transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-green-500/90 border-green-400 text-white'
                : toast.type === 'error'
                ? 'bg-red-500/90 border-red-400 text-white'
                : 'bg-blue-500/90 border-blue-400 text-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-3 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
                title="Fermer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
