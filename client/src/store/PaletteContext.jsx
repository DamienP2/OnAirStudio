import React, { createContext, useContext, useEffect, useState } from 'react';
import { socket } from '../socket';

// Provider léger qui expose la palette de couleurs partagée (settings → colorPalette).
// Lecture seule depuis ici — les mutations passent par SettingsPanel qui émet
// un updateSettings standard avec la nouvelle palette.
const PaletteContext = createContext({ palette: [] });

export function PaletteProvider({ children }) {
  const [palette, setPalette] = useState([]);

  useEffect(() => {
    const onSettings = (s) => {
      if (Array.isArray(s?.colorPalette)) setPalette(s.colorPalette);
    };
    socket.on('settingsUpdate', onSettings);
    socket.emit('requestSettings');
    return () => socket.off('settingsUpdate', onSettings);
  }, []);

  return <PaletteContext.Provider value={{ palette }}>{children}</PaletteContext.Provider>;
}

export function usePalette() {
  return useContext(PaletteContext);
}
