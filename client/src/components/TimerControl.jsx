import React, { useState, useEffect } from 'react';
import { socket } from '../socket';

export default function TimerControl({ isRunning, isPaused, elapsedTime, remainingTime, targetTime, currentTime, displayMode, onDisplayModeChange, colors, onColorsChange }) {
  const [duration, setDuration] = useState('00:00:00');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showColorsModal, setShowColorsModal] = useState(false);
  const [presetTimes, setPresetTimes] = useState([]);

  useEffect(() => {
    // Demander les durées prédéfinies au serveur lors de la connexion
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

  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);
    socket.emit('durationSelected', newDuration);
    socket.emit('setTimer', newDuration);
  };

  const handleStartStop = () => {
    if (!isRunning) {
      const [hours, minutes, seconds] = duration.split(':').map(Number);
      const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
      socket.emit('startTimer', totalSeconds);
    } else {
      socket.emit('stopTimer');
    }
  };

  const handlePauseResume = () => {
    if (isRunning && !isPaused) {
      socket.emit('pauseTimer');
    } else if (isRunning && isPaused) {
      socket.emit('resumeTimer');
    }
  };

  const handleReset = () => {
    setShowResetModal(true);
  };

  const confirmReset = () => {
    socket.emit('resetTimer');
    setDuration('00:00:00');
    socket.emit('durationSelected', '00:00:00');
    setShowResetModal(false);
  };

  const cancelReset = () => {
    setShowResetModal(false);
  };

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

  const handleResetColors = () => {
    setShowColorsModal(true);
  };

  const confirmResetColors = () => {
    const defaultColors = {
      current: '#FFFFFF',
      elapsed: '#3B82F6',
      remaining: '#EF4444'
    };
    onColorsChange(defaultColors);
    Object.entries(defaultColors).forEach(([clock, color]) => {
      socket.emit('updateColor', { clock, color });
    });
    setShowColorsModal(false);
  };

  const cancelResetColors = () => {
    setShowColorsModal(false);
  };

  return (
    <div className="space-y-12 w-full">

      {/* Section Style */}
      <section className="space-y-6">
        
        <div className="space-y-8">
          {/* Mode d'affichage */}
          <div>
            
            <div className="grid grid-cols-2 gap-4">
                              <button
                  onClick={() => onDisplayModeChange('two')}
                  className={`relative flex flex-col items-center justify-center py-4 px-6 rounded-lg transition-colors ${
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
                  onClick={() => onDisplayModeChange('three')}
                  className={`relative flex flex-col items-center justify-center py-4 px-6 rounded-lg transition-colors ${
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

         
        </div>
      </section>
      {/* Section Contrôle */}
      <section className="space-y-10">
        {/* Sélection de la durée */}
        <div className="flex flex-col space-y-8">
          <div className="flex justify-center items-center gap-6 bg-gray-800 p-6 rounded-lg">
            {/* Heures */}
            <div className="flex items-center gap-1">
              {/* Dizaines d'heures */}
              <div className="flex flex-col items-center">
                <button 
                  onClick={() => {
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentTens = Math.floor(h / 10);
                    const newTens = (currentTens + 1) % 3;
                    const newHours = (newTens * 10) + (h % 10);
                    if (newHours < 24) {
                      handleDurationChange(`${String(newHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                    }
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <div className="text-5xl font-mono font-bold text-white w-10 text-center">
                  {duration.split(':')[0][0]}
                </div>
                <button 
                  onClick={() => {
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentTens = Math.floor(h / 10);
                    const newTens = currentTens > 0 ? currentTens - 1 : 2;
                    const newHours = (newTens * 10) + (h % 10);
                    if (newHours < 24) {
                      handleDurationChange(`${String(newHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                    }
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
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
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentOnes = h % 10;
                    const currentTens = Math.floor(h / 10);
                    const newOnes = (currentOnes + 1) % 10;
                    const newHours = (currentTens * 10) + newOnes;
                    if (newHours < 24) {
                      handleDurationChange(`${String(newHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                    }
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <div className="text-5xl font-mono font-bold text-white w-10 text-center">
                  {duration.split(':')[0][1]}
                </div>
                <button 
                  onClick={() => {
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentOnes = h % 10;
                    const currentTens = Math.floor(h / 10);
                    const newOnes = currentOnes > 0 ? currentOnes - 1 : 9;
                    const newHours = (currentTens * 10) + newOnes;
                    if (newHours < 24) {
                      handleDurationChange(`${String(newHours).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                    }
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
              <div className="text-4xl font-mono font-bold text-gray-600 mx-4">:</div>
            </div>

            {/* Minutes */}
            <div className="flex items-center gap-1">
              {/* Dizaines de minutes */}
              <div className="flex flex-col items-center">
                <button 
                  onClick={() => {
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentTens = Math.floor(m / 10);
                    const newTens = (currentTens + 1) % 6;
                    const newMinutes = (newTens * 10) + (m % 10);
                    handleDurationChange(`${String(h).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <div className="text-5xl font-mono font-bold text-white w-10 text-center">
                  {duration.split(':')[1][0]}
                </div>
                <button 
                  onClick={() => {
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentTens = Math.floor(m / 10);
                    const newTens = currentTens > 0 ? currentTens - 1 : 5;
                    const newMinutes = (newTens * 10) + (m % 10);
                    handleDurationChange(`${String(h).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
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
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentOnes = m % 10;
                    const currentTens = Math.floor(m / 10);
                    const newOnes = (currentOnes + 1) % 10;
                    const newMinutes = (currentTens * 10) + newOnes;
                    handleDurationChange(`${String(h).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <div className="text-5xl font-mono font-bold text-white w-10 text-center">
                  {duration.split(':')[1][1]}
                </div>
                <button 
                  onClick={() => {
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentOnes = m % 10;
                    const currentTens = Math.floor(m / 10);
                    const newOnes = currentOnes > 0 ? currentOnes - 1 : 9;
                    const newMinutes = (currentTens * 10) + newOnes;
                    handleDurationChange(`${String(h).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
              <div className="text-4xl font-mono font-bold text-gray-600 mx-4">:</div>
            </div>

            {/* Secondes */}
            <div className="flex items-center gap-1">
              {/* Dizaines de secondes */}
              <div className="flex flex-col items-center">
                <button 
                  onClick={() => {
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentTens = Math.floor(s / 10);
                    const newTens = (currentTens + 1) % 6;
                    const newSeconds = (newTens * 10) + (s % 10);
                    handleDurationChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`);
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <div className="text-5xl font-mono font-bold text-white w-10 text-center">
                  {duration.split(':')[2][0]}
                </div>
                <button 
                  onClick={() => {
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentTens = Math.floor(s / 10);
                    const newTens = currentTens > 0 ? currentTens - 1 : 5;
                    const newSeconds = (newTens * 10) + (s % 10);
                    handleDurationChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`);
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
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
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentOnes = s % 10;
                    const currentTens = Math.floor(s / 10);
                    const newOnes = (currentOnes + 1) % 10;
                    const newSeconds = (currentTens * 10) + newOnes;
                    handleDurationChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`);
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <div className="text-5xl font-mono font-bold text-white w-10 text-center">
                  {duration.split(':')[2][1]}
                </div>
                <button 
                  onClick={() => {
                    const [h, m, s] = duration.split(':').map(Number);
                    const currentOnes = s % 10;
                    const currentTens = Math.floor(s / 10);
                    const newOnes = currentOnes > 0 ? currentOnes - 1 : 9;
                    const newSeconds = (currentTens * 10) + newOnes;
                    handleDurationChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`);
                  }}
                  className="p-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {presetTimes.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleDurationChange(preset.value)}
                className={`relative flex flex-col items-center justify-center py-4 px-6 rounded-lg transition-colors ${
                  duration === preset.value
                    ? 'bg-gray-700 border-2 border-blue-500'
                    : 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
                }`}
              >
                {duration === preset.value && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
                <span className="text-base text-gray-300">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Boutons de contrôle */}
        <div className="flex justify-center gap-6 pt-6">
          <button
            onClick={handleReset}
            disabled={!isRunning}
            className={`relative rounded-full p-4 focus:outline-none ${
              !isRunning 
                ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className={`w-8 h-8 ${!isRunning ? 'text-gray-400' : 'text-gray-200'}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
              />
            </svg>
          </button>
          
          <button
            onClick={handlePauseResume}
            disabled={!isRunning}
            className={`p-4 rounded-full transition-all duration-200 focus:outline-none ${
              !isRunning 
                ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                : isPaused
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-yellow-500 hover:bg-yellow-600'
            }`}
          >
            {isPaused ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 ${!isRunning ? 'text-gray-400' : 'text-gray-200'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 ${!isRunning ? 'text-gray-400' : 'text-gray-200'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Modal de confirmation */}
        {showResetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
              <h3 className="text-xl font-bold text-white mb-4">Confirmation</h3>
              <p className="text-gray-300 mb-6">
                Êtes-vous sûr de vouloir stopper le chronomètre ?
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={cancelReset}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 focus:outline-none"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmReset}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none"
                >
                  Stopper
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      

      {/* Modal de confirmation des couleurs */}
      {showColorsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Confirmation</h3>
            <p className="text-gray-300 mb-6">
              Êtes-vous sûr de vouloir réinitialiser les couleurs ?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelResetColors}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 focus:outline-none"
              >
                Annuler
              </button>
              <button
                onClick={confirmResetColors}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 