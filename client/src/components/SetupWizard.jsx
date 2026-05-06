import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import Toast from './Toast';

export default function SetupWizard({ isOpen, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [settings, setSettings] = useState({
    ntpServer: '',
    studioName: '',
    defaultDisplayMode: 'two',
    colors: {
      current: '#FFFFFF',
      elapsed: '#3B82F6',
      remaining: '#EF4444'
    },
    presetTimes: [],
    adminPassword: ''
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info', isVisible: false });
  const [newPreset, setNewPreset] = useState({ value: '' });
  const [isLoaded, setIsLoaded] = useState(false);

  const totalSteps = 5;

  // Charger les paramètres par défaut depuis le serveur
  useEffect(() => {
    if (isOpen && !isLoaded) {
      // Demander les paramètres par défaut au serveur
      socket.emit('requestDefaultSettings');
      
      socket.on('defaultSettingsUpdate', (defaultSettings) => {
        setSettings(prev => ({
          ...prev,
          ntpServer: defaultSettings.ntpServer,
          studioName: defaultSettings.studioName,
          defaultDisplayMode: defaultSettings.defaultDisplayMode,
          colors: { ...defaultSettings.colors },
          presetTimes: [...defaultSettings.presetTimes]
        }));
        setIsLoaded(true);
      });

      return () => {
        socket.off('defaultSettingsUpdate');
      };
    }
  }, [isOpen, isLoaded]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const handleNext = () => {
    if (currentStep === 5) {
      // Validation du mot de passe
      if (settings.adminPassword.length < 4) {
        setPasswordError('Le mot de passe doit contenir au moins 4 caractères');
        return;
      }
      if (settings.adminPassword !== confirmPassword) {
        setPasswordError('Les mots de passe ne correspondent pas');
        return;
      }
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      setPasswordError('');
    } else {
      // Finaliser la configuration
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setPasswordError('');
    }
  };

  const handleComplete = () => {
    // Sauvegarder les paramètres
    const { adminPassword, ...settingsToSave } = settings;
    socket.emit('updateSettings', settingsToSave);
    
    // Sauvegarder le mot de passe (à implémenter côté serveur)
    socket.emit('setAdminPassword', adminPassword);
    
    showToast('Configuration terminée avec succès !', 'success');
    setTimeout(() => {
      onComplete();
    }, 2000);
  };

  const updateSettings = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  // Fonction pour convertir les minutes en format HH:MM:SS
  const minutesToTimeFormat = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
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

  const addPresetTime = () => {
    if (newPreset.value) {
      const minutes = parseInt(newPreset.value);
      const timeValue = minutesToTimeFormat(minutes);
      const label = `${minutes} min`;
      const newPresetTime = { label: label, value: timeValue };
      setSettings(prev => ({
        ...prev,
        presetTimes: [...prev.presetTimes, newPresetTime]
      }));
      setNewPreset({ value: '' });
    }
  };

  const removePresetTime = (index) => {
    setSettings(prev => ({
      ...prev,
      presetTimes: prev.presetTimes.filter((_, i) => i !== index)
    }));
  };

  const renderStep1 = () => (
    <div className="text-center">
      <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-blue-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Bienvenue dans OnAir Studio</h2>
      <p className="text-gray-400 mb-8">
        Cet assistant vous guidera pour configurer votre application.
        <br />
        Nous allons configurer les paramètres essentiels pour votre environnement de travail.
      </p>
      
      {!isLoaded && (
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span className="text-blue-400">Chargement des paramètres par défaut...</span>
          </div>
        </div>
      )}
      
      <div className="bg-gray-700/30 rounded-lg p-4 mb-8">
        <h3 className="text-lg font-semibold text-white mb-2">Ce que nous allons configurer :</h3>
        <ul className="text-gray-300 text-left space-y-2">
          <li>• Nom de votre studio</li>
          <li>• Serveur NTP pour la synchronisation horaire</li>
          <li>• Mode d'affichage par défaut</li>
          <li>• Couleurs des horloges</li>
          <li>• Temps prédéfinis</li>
          <li>• Mot de passe d'administration</li>
        </ul>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Configuration de l'horloge</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nom de votre studio
          </label>
          <input
            type="text"
            value={settings.studioName}
            onChange={(e) => updateSettings({ studioName: e.target.value })}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            placeholder="Ex: Studio Principal"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Serveur NTP
          </label>
          <input
            type="text"
            value={settings.ntpServer}
            onChange={(e) => updateSettings({ ntpServer: e.target.value })}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            placeholder="pool.ntp.org"
          />
          <p className="text-xs text-gray-400 mt-1">Serveur de synchronisation horaire</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Mode d'affichage par défaut
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => updateSettings({ defaultDisplayMode: 'two' })}
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
              onClick={() => updateSettings({ defaultDisplayMode: 'three' })}
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
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Couleurs des horloges</h2>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-2">Heure actuelle</label>
          <input
            type="color"
            value={settings.colors.current}
            onChange={(e) => updateSettings({ colors: { ...settings.colors, current: e.target.value } })}
            className="w-full h-12 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-2">Temps écoulé</label>
          <input
            type="color"
            value={settings.colors.elapsed}
            onChange={(e) => updateSettings({ colors: { ...settings.colors, elapsed: e.target.value } })}
            className="w-full h-12 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-2">Temps restant</label>
          <input
            type="color"
            value={settings.colors.remaining}
            onChange={(e) => updateSettings({ colors: { ...settings.colors, remaining: e.target.value } })}
            className="w-full h-12 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Temps prédéfinis</h2>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {settings.presetTimes.map((preset, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
              <div>
                <div className="text-sm text-gray-300">{preset.label}</div>
                <div className="text-xs text-gray-400 font-mono">{preset.value}</div>
              </div>
              <button
                onClick={() => removePresetTime(index)}
                className="p-1 text-red-400 hover:text-red-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        
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
            onClick={addPresetTime}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Mot de passe d'administration</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Mot de passe
          </label>
          <input
            type="password"
            value={settings.adminPassword}
            onChange={(e) => updateSettings({ adminPassword: e.target.value })}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            placeholder="Mot de passe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Confirmer le mot de passe
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            placeholder="Confirmer le mot de passe"
          />
        </div>

        {passwordError && (
          <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{passwordError}</p>
          </div>
        )}

        <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-400 text-sm">
            Ce mot de passe vous sera nécessaire pour accéder aux paramètres de l'application.
            <br />
            Assurez-vous de le noter dans un endroit sûr.
          </p>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return renderStep1();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl p-8 max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        
        {/* Barre de progression */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Étape {currentStep} sur {totalSteps}</span>
            <span className="text-sm text-gray-400">{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Contenu de l'étape */}
        <div className="mb-8">
          {renderCurrentStep()}
        </div>

        {/* Boutons de navigation */}
        <div className="flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1 || !isLoaded}
            className={`px-6 py-3 rounded-lg transition-colors ${
              currentStep === 1 || !isLoaded
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            Précédent
          </button>
          
          <button
            onClick={handleNext}
            disabled={!isLoaded}
            className={`px-6 py-3 rounded-lg transition-colors ${
              !isLoaded
                ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {currentStep === totalSteps ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={closeToast}
      />
    </div>
  );
}
