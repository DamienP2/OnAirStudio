import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import TimerControl from '../components/TimerControl';
import TimeDisplay from '../components/TimeDisplay';
import Settings from './Settings';
import SetupWizard from '../components/SetupWizard';
import Help from './Help';

/*==============================================
=                 Composants                  =
===============================================*/

/**
 * Panneau ON AIR avec effet de clignotement
 * @param {boolean} isBlinking - État de clignotement
 * @param {boolean} isVisible - Visibilité pendant le clignotement
 * @param {boolean} isOnAir - État ON AIR actif/inactif
 * @param {string} className - Classes CSS additionnelles
 */
const OnAirPanel = ({ isBlinking, isVisible, isOnAir, className = "" }) => (
  <div className={`px-2 lg:px-6 py-2 lg:py-2 rounded-xl text-lg lg:text-2xl font-bold tracking-[0.2em] transition-all duration-700 ${
    isBlinking 
      ? (isVisible ? 'bg-red-600 text-white shadow-lg shadow-red-600/50' : 'bg-gray-800 text-gray-600')
      : (isOnAir ? 'bg-red-600 text-white shadow-lg shadow-red-600/50' : 'bg-gray-800 text-gray-600')
  } ${className}`}>
    ON AIR
  </div>
);

/**
 * Carte d'information avec gradient
 */
const InfoCard = ({ title, value, icon, color = "blue", className = "" }) => (
  <div className={`bg-gradient-to-br from-gray-800 to-gray-900 p-4 lg:p-6 rounded-xl border border-gray-700 shadow-lg ${className}`}>
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-2 rounded-lg bg-${color}-500/20 text-${color}-400`}>
        {icon}
      </div>
      <h3 className="text-sm lg:text-base font-medium text-gray-400 uppercase tracking-wider">
        {title}
      </h3>
    </div>
    <div className="text-lg lg:text-2xl font-mono font-bold text-white">
      {value}
    </div>
  </div>
);

/**
 * Bouton d'action avec effet hover
 */
const ActionButton = ({ onClick, disabled, children, variant = "primary", className = "" }) => {
  const baseClasses = "flex items-center justify-center gap-2 px-4 lg:px-6 py-3 lg:py-4 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900";
  
  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white",
    success: "bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white",
    warning: "bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400 text-white",
    danger: "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
    secondary: "bg-gray-700 hover:bg-gray-600 focus:ring-gray-500 text-white"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

/*==============================================
=            Composant Principal              =
===============================================*/

export default function Control2({ timerState }) {
  /*----------  États  ----------*/
  const [displayMode, setDisplayMode] = useState('three');
  const [colors, setColors] = useState({
    current: '#FFFFFF',
    elapsed: '#3B82F6',
    remaining: '#EF4444'
  });
  const [isOnAir, setIsOnAir] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [studioName, setStudioName] = useState('Studio 2');
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  /*----------  Gestion des événements socket  ----------*/
  useEffect(() => {
    socket.on('displayPreferences', (prefs) => {
      setDisplayMode(prefs.mode);
    });

    socket.on('displayModeUpdate', (mode) => {
      setDisplayMode(mode);
    });

    socket.on('colorUpdate', (newColors) => {
      setColors(newColors);
    });

    socket.on('timerUpdate', (state) => {
      setIsBlinking(state.isRunning && state.isPaused);
    });

    socket.on('onAirStateUpdate', ({ isOnAir: newIsOnAir }) => {
      setIsOnAir(newIsOnAir);
    });

    socket.on('studioNameUpdate', (name) => {
      setStudioName(name);
    });

    socket.on('firstStartupStatus', ({ isFirstStartup }) => {
      if (isFirstStartup) {
        setShowSetupWizard(true);
      }
    });

    // Nettoyage des écouteurs d'événements
    return () => {
      socket.off('displayPreferences');
      socket.off('displayModeUpdate');
      socket.off('colorUpdate');
      socket.off('timerUpdate');
      socket.off('onAirStateUpdate');
      socket.off('studioNameUpdate');
      socket.off('firstStartupStatus');
    };
  }, []);

  /*----------  Effet de clignotement  ----------*/
  useEffect(() => {
    if (!isBlinking) {
      setIsVisible(true);
      return;
    }

    const interval = setInterval(() => {
      setIsVisible(v => !v);
    }, 1000);

    return () => clearInterval(interval);
  }, [isBlinking]);

  // Fonction pour gérer le changement de mode
  const handleDisplayModeChange = (mode) => {
    setDisplayMode(mode);
    socket.emit('displayModeChange', mode);
  };

  // Fonction pour formater le temps
  const formatTime = (seconds) => {
    if (typeof seconds !== 'number' || seconds < 0) {
      return '00:00:00';
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs]
      .map(v => String(v).padStart(2, '0'))
      .join(':');
  };

  // Fonction pour obtenir le statut du timer
  const getTimerStatus = () => {
    if (!timerState.isRunning) return 'Arrêté';
    if (timerState.isPaused) return 'En pause';
    return 'En cours';
  };

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = () => {
    if (!timerState.isRunning) return 'gray';
    if (timerState.isPaused) return 'yellow';
    return 'green';
  };

  // États pour la gestion du timer
  const [duration, setDuration] = useState('00:00:00');
  const [presetTimes, setPresetTimes] = useState([]);

  // Gestion des durées prédéfinies
  useEffect(() => {
    socket.emit('requestPresetTimes');

    socket.on('durationUpdate', (newDuration) => {
      setDuration(newDuration);
    });

    socket.on('initialState', (state) => {
      setDuration(state.selectedDuration);
    });

    socket.on('presetTimesUpdate', (times) => {
      setPresetTimes(times);
    });

    return () => {
      socket.off('durationUpdate');
      socket.off('initialState');
      socket.off('presetTimesUpdate');
    };
  }, []);

  // Mise à jour de l'affichage du réglage manuel quand le timer est en pause
  useEffect(() => {
    if (timerState.isRunning && timerState.isPaused) {
      // En pause, afficher le temps restant dans le réglage manuel
      const remainingSeconds = Math.max(0, timerState.remainingTime);
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;
      const remainingDuration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setDuration(remainingDuration);
    }
  }, [timerState.isRunning, timerState.isPaused, timerState.remainingTime]);

  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);
    socket.emit('durationSelected', newDuration);
    
    // Si le timer est en pause, on modifie le temps restant sans remettre à zéro le temps écoulé
    if (timerState.isRunning && timerState.isPaused) {
      const [hours, minutes, seconds] = newDuration.split(':').map(Number);
      const newTargetTime = (hours * 3600) + (minutes * 60) + seconds;
      socket.emit('updateRemainingTime', newTargetTime);
    } else {
      // Comportement normal pour les autres cas
      socket.emit('setTimer', newDuration);
    }
  };

  const handleStartStop = () => {
    if (!timerState.isRunning) {
      const [hours, minutes, seconds] = duration.split(':').map(Number);
      const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
      socket.emit('startTimer', totalSeconds);
    } else {
      setShowStopConfirm(true);
    }
  };

  const confirmStop = () => {
    socket.emit('stopTimer');
    setShowStopConfirm(false);
  };

  const cancelStop = () => {
    setShowStopConfirm(false);
  };

  // Fonction pour gérer l'accès aux paramètres avec mot de passe
  const handleSettingsAccess = () => {
    setShowPasswordModal(true);
    setPassword('');
    setPasswordError(false);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    socket.emit('checkAdminPassword', password, ({ isValid }) => {
      if (isValid) {
        setShowPasswordModal(false);
        setShowSettings(true);
        setPassword('');
        setPasswordError(false);
      } else {
        setPasswordError(true);
        setPassword('');
      }
    });
  };

  const cancelPassword = () => {
    setShowPasswordModal(false);
    setPassword('');
    setPasswordError(false);
  };

  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    // Recharger la page pour appliquer les nouveaux paramètres
    window.location.reload();
  };

  const handlePauseResume = () => {
    if (timerState.isRunning && !timerState.isPaused) {
      socket.emit('pauseTimer');
    } else if (timerState.isRunning && timerState.isPaused) {
      socket.emit('resumeTimer');
    }
  };

  return (
    <div className="w-full min-h-screen md:min-h-screen lg:fixed lg:inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* En-tête */}
      <header className="w-full bg-black/50 backdrop-blur-sm border-b border-gray-800 h-20 md:h-22 lg:h-24 lg:sticky lg:top-0 z-10">
        <div className="h-full px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-full">
            {/* Logo et titre */}
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Logo" className="h-16 md:h-18 lg:h-20 w-auto" />
              <div className="h-8 md:h-9 lg:h-10 w-px bg-gradient-to-b from-transparent via-gray-600 to-transparent"></div>
                              <div className="flex flex-col">
                  <h1 className="text-xl md:text-2xl lg:text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                   {studioName}
                  </h1>
                  <span className="text-sm md:text-sm lg:text-sm text-gray-400 font-medium">
                   OnAir Studio v2.0
                  </span>
                </div>
            </div>

            {/* Panneau ON AIR */}
            <OnAirPanel 
              isBlinking={isBlinking} 
              isVisible={isVisible} 
              isOnAir={isOnAir} 
            />
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="w-full px-4 md:px-6 lg:px-8 py-4 md:py-5 lg:py-6 md:min-h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-6rem)]">
        <div className="w-full grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6 md:h-full lg:h-full">
          
          {/* Colonne 1 - Contrôles principaux (3/4) */}
          <div className="w-full md:col-span-3 lg:col-span-3 md:h-full lg:h-full">
            <div className="w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 shadow-xl p-4 md:p-5 lg:p-6 md:h-full lg:h-full md:overflow-y-auto lg:overflow-y-auto">
              
             

              {/* Choix du type d'affichage et réglages en 2 colonnes */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                
                {/* Colonne gauche - Modes d'affichage (1/3) */}
                <div className="lg:col-span-1">
                  <div className="space-y-4">
                    <button
                      onClick={() => handleDisplayModeChange('two')}
                      className={`relative w-full flex flex-col items-center justify-center py-4 px-6 rounded-lg transition-colors ${
                        displayMode === 'two'
                          ? 'bg-gray-700 border-2 border-blue-500'
                          : 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {displayMode === 'two' && (
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
                      onClick={() => handleDisplayModeChange('three')}
                      className={`relative w-full flex flex-col items-center justify-center py-4 px-6 rounded-lg transition-colors ${
                        displayMode === 'three'
                          ? 'bg-gray-700 border-2 border-blue-500'
                          : 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {displayMode === 'three' && (
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

                {/* Colonne droite - Réglage manuel et temps prédéfinis (2/3) */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Réglage manuel */}
                  <div>
                    <div className={`flex justify-center items-center gap-4 p-6 rounded-lg transition-all duration-200 min-h-[150px] ${
                      timerState.isRunning && !timerState.isPaused ? 'bg-gray-700 opacity-50' : 'bg-gray-800'
                    }`}>
                      {/* Heures */}
                      <div className="flex items-center gap-1">
                        {/* Dizaines d'heures */}
                        <div className="flex flex-col items-center">
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentTens = Math.floor(h / 10);
                                const newTens = (currentTens + 1) % 3;
                                const newHours = (newTens * 10) + (h % 10);
                                if (newHours < 24) {
                                  handleDurationChange(`${String(newHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                                }
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning 
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <div className="text-3xl font-mono font-bold text-white w-8 text-center">
                            {duration.split(':')[0][0]}
                          </div>
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentTens = Math.floor(h / 10);
                                const newTens = currentTens > 0 ? currentTens - 1 : 2;
                                const newHours = (newTens * 10) + (h % 10);
                                if (newHours < 24) {
                                  handleDurationChange(`${String(newHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                                }
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                        {/* Unités d'heures */}
                        <div className="flex flex-col items-center">
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentOnes = h % 10;
                                const currentTens = Math.floor(h / 10);
                                const newOnes = (currentOnes + 1) % 10;
                                const newHours = (currentTens * 10) + newOnes;
                                if (newHours < 24) {
                                  handleDurationChange(`${String(newHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                                }
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <div className="text-3xl font-mono font-bold text-white w-8 text-center">
                            {duration.split(':')[0][1]}
                          </div>
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentOnes = h % 10;
                                const currentTens = Math.floor(h / 10);
                                const newOnes = currentOnes > 0 ? currentOnes - 1 : 9;
                                const newHours = (currentTens * 10) + newOnes;
                                if (newHours < 24) {
                                  handleDurationChange(`${String(newHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                                }
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                        <div className="text-2xl font-mono font-bold text-gray-600 mx-2">:</div>
                      </div>

                      {/* Minutes */}
                      <div className="flex items-center gap-1">
                        {/* Dizaines de minutes */}
                        <div className="flex flex-col items-center">
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentTens = Math.floor(m / 10);
                                const newTens = (currentTens + 1) % 6;
                                const newMinutes = (newTens * 10) + (m % 10);
                                handleDurationChange(`${String(h).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <div className="text-3xl font-mono font-bold text-white w-8 text-center">
                            {duration.split(':')[1][0]}
                          </div>
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentTens = Math.floor(m / 10);
                                const newTens = currentTens > 0 ? currentTens - 1 : 5;
                                const newMinutes = (newTens * 10) + (m % 10);
                                handleDurationChange(`${String(h).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                        {/* Unités de minutes */}
                        <div className="flex flex-col items-center">
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentOnes = m % 10;
                                const currentTens = Math.floor(m / 10);
                                const newOnes = (currentOnes + 1) % 10;
                                const newMinutes = (currentTens * 10) + newOnes;
                                handleDurationChange(`${String(h).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <div className="text-3xl font-mono font-bold text-white w-8 text-center">
                            {duration.split(':')[1][1]}
                          </div>
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentOnes = m % 10;
                                const currentTens = Math.floor(m / 10);
                                const newOnes = currentOnes > 0 ? currentOnes - 1 : 9;
                                const newMinutes = (currentTens * 10) + newOnes;
                                handleDurationChange(`${String(h).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                        <div className="text-2xl font-mono font-bold text-gray-600 mx-2">:</div>
                      </div>

                      {/* Secondes */}
                      <div className="flex items-center gap-1">
                        {/* Dizaines de secondes */}
                        <div className="flex flex-col items-center">
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentTens = Math.floor(s / 10);
                                const newTens = (currentTens + 1) % 6;
                                const newSeconds = (newTens * 10) + (s % 10);
                                handleDurationChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`);
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <div className="text-3xl font-mono font-bold text-white w-8 text-center">
                            {duration.split(':')[2][0]}
                          </div>
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentTens = Math.floor(s / 10);
                                const newTens = currentTens > 0 ? currentTens - 1 : 5;
                                const newSeconds = (newTens * 10) + (s % 10);
                                handleDurationChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`);
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                        {/* Unités de secondes */}
                        <div className="flex flex-col items-center">
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentOnes = s % 10;
                                const currentTens = Math.floor(s / 10);
                                const newOnes = (currentOnes + 1) % 10;
                                const newSeconds = (currentTens * 10) + newOnes;
                                handleDurationChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`);
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <div className="text-3xl font-mono font-bold text-white w-8 text-center">
                            {duration.split(':')[2][1]}
                          </div>
                          <button 
                            onClick={() => {
                              if (!timerState.isRunning || timerState.isPaused) {
                                const [h, m, s] = duration.split(':').map(Number);
                                const currentOnes = s % 10;
                                const currentTens = Math.floor(s / 10);
                                const newOnes = currentOnes > 0 ? currentOnes - 1 : 9;
                                const newSeconds = (currentTens * 10) + newOnes;
                                handleDurationChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`);
                              }
                            }}
                            disabled={timerState.isRunning && !timerState.isPaused}
                            className={`p-1 rounded transition-colors focus:outline-none ${
                              timerState.isRunning && !timerState.isPaused
                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Temps prédéfinis */}
                  <div>
                    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 transition-all duration-200 ${
                      timerState.isRunning && !timerState.isPaused ? 'opacity-50' : ''
                    }`}>
                      {presetTimes.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => {
                            if (!timerState.isRunning || timerState.isPaused) {
                              handleDurationChange(preset.value);
                            }
                          }}
                          disabled={timerState.isRunning && !timerState.isPaused}
                          className={`relative flex flex-col items-center justify-center py-3 px-4 rounded-lg transition-colors ${
                            timerState.isRunning && !timerState.isPaused
                              ? 'bg-gray-700 border-2 border-gray-600 opacity-50 cursor-not-allowed'
                              : duration === preset.value
                                ? 'bg-gray-700 border-2 border-blue-500'
                                : 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          {duration === preset.value && (
                            <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                          <span className="text-sm text-gray-300">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Les deux horloges sur une seule colonne */}
              <div className="flex items-center justify-center lg:gap-6 mt-8">
                {/* Temps restant */}
                <div className="flex flex-col items-center">
                  <div className="w-48 h-48 md:w-48 md:h-48 lg:w-96 lg:h-96">
                    <TimeDisplay
                      label="RESTANT"
                      time={timerState.remainingTime}
                      variant="remaining"
                      warning={timerState.remainingTime <= 10 && timerState.remainingTime > 0}
                      size="100%"
                      color={colors.remaining}
                      textSize="text-2xl md:text-3xl lg:text-5xl"
                      labelSize="text-sm md:text-base lg:text-lg"
                    />
                  </div>
                </div>

                {/* Séparateur vertical */}
                <div className="w-px h-32 md:h-40 lg:h-48 bg-gradient-to-b from-transparent via-gray-600 to-transparent"></div>

                {/* Temps écoulé */}
                <div className="flex flex-col items-center">
                  <div className="w-48 h-48 md:w-48 md:h-48 lg:w-96 lg:h-96">
                    <TimeDisplay
                      label="ÉCOULÉ"
                      time={timerState.elapsedTime}
                      variant="elapsed"
                      size="100%"
                      color={colors.elapsed}
                      textSize="text-2xl md:text-3xl lg:text-5xl"
                      labelSize="text-sm md:text-base lg:text-lg"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Colonne 2 - Horloge NTP et statuts (1/4) */}
          <div className="w-full md:col-span-1 lg:col-span-1 md:h-full lg:h-full md:flex md:flex-col lg:flex lg:flex-col md:space-y-3 lg:space-y-3 lg:space-y-4">
            
            {/* Contrôle du timer en haut */}
            <div className="w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 shadow-xl p-3 md:p-4 lg:p-4 md:flex-shrink-0 lg:flex-shrink-0 mb-4 md:mb-0 lg:mb-0">
              <div className="flex justify-center gap-6">
                <button
                  onClick={handleStartStop}
                  disabled={timerState.targetTime === 0}
                  className={`relative rounded-full p-4 focus:outline-none transition-all duration-200 ${
                    timerState.targetTime === 0
                      ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                      : !timerState.isRunning
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {!timerState.isRunning ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 ${timerState.targetTime === 0 ? 'text-gray-400' : 'text-white'}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
                      <rect x="6" y="6" width="12" height="12" />
                    </svg>
                  )}
                </button>
                
                <button
                  onClick={handlePauseResume}
                  disabled={!timerState.isRunning}
                  className={`p-4 rounded-full transition-all duration-200 focus:outline-none ${
                    !timerState.isRunning 
                      ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                      : timerState.isPaused
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-yellow-500 hover:bg-yellow-600'
                  }`}
                >
                  {timerState.isPaused ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 ${!timerState.isRunning ? 'text-gray-400' : 'text-white'}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 ${!timerState.isRunning ? 'text-gray-400' : 'text-white'}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Widget Système avec indicateurs - collé en bas */}
            <div className="w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 shadow-xl p-3 md:p-4 lg:p-4 md:flex-shrink-0 lg:flex-shrink-0 md:mt-auto lg:mt-auto">
              {/* Icônes d'action */}
              <div className="flex items-center justify-end mb-3">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSettingsAccess}
                    className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors duration-200 text-gray-300 hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => setShowHelpModal(true)}
                    className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors duration-200 text-gray-300 hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Horloge principale */}
              <div className="text-center mb-3">
                <div className="text-xl md:text-2xl lg:text-2xl font-mono font-bold text-white mb-1">
                  {timerState.currentTime}
                </div>
                <div className="text-xs text-gray-400 font-medium">Heure serveur</div>
              </div>

              {/* Indicateurs système en 3 colonnes */}
              <div className="grid grid-cols-3 gap-2">
                {/* Indicateur NTP */}
                <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700/30">
                  <div className={`w-2 h-2 rounded-full mb-1 ${timerState.isNTPActive ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="text-xs text-gray-300 text-center">NTP</span>
                  <span className={`text-xs font-medium ${timerState.isNTPActive ? 'text-green-400' : 'text-yellow-400'}`}>
                    {timerState.isNTPActive ? 'OK' : 'KO'}
                  </span>
                </div>

                {/* Indicateur USB Relay */}
                <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700/30">
                  <div className={`w-2 h-2 rounded-full mb-1 ${timerState.usbRelayStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs text-gray-300 text-center">USB</span>
                  <span className={`text-xs font-medium ${timerState.usbRelayStatus ? 'text-green-400' : 'text-red-400'}`}>
                    {timerState.usbRelayStatus ? 'OK' : 'KO'}
                  </span>
                </div>

                {/* Indicateur Clients HTTP */}
                <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700/30">
                  <div className={`w-2 h-2 rounded-full mb-1 ${timerState.httpClientsCount > 0 ? 'bg-blue-500' : 'bg-gray-500'}`}></div>
                  <span className="text-xs text-gray-300 text-center">HTTP</span>
                  <span className={`text-xs font-medium ${timerState.httpClientsCount > 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                    {timerState.httpClientsCount || 0}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Popup de confirmation d'arrêt */}
      {showStopConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl p-6 max-w-sm mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Arrêter le timer ?</h3>
              <p className="text-gray-400 mb-6">Cette action ne peut pas être annulée.</p>
              <div className="flex gap-3">
                <button
                  onClick={cancelStop}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmStop}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Arrêter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de mot de passe */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl p-6 max-w-sm mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Accès aux paramètres</h3>
              <p className="text-gray-400 mb-6">Veuillez saisir le mot de passe</p>
              
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white focus:outline-none focus:border-blue-500 ${
                      passwordError ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="Mot de passe"
                    autoFocus
                  />
                  {passwordError && (
                    <p className="text-red-400 text-sm mt-2">Mot de passe incorrect</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={cancelPassword}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Accéder
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assistant de configuration initial */}
      <SetupWizard 
        isOpen={showSetupWizard} 
        onComplete={handleSetupComplete} 
      />

      {/* Page de paramètres */}
      <Settings 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />

      {/* Modal d'aide */}
      <Help 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
      />
    </div>
  );
}