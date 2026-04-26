import { io } from 'socket.io-client';

// En dev : Vite proxy (5173 → 3333) gère /socket.io. En prod : origine de la page.
// Dans les 2 cas, l'URL est l'origine actuelle — pas de config d'IP en dur.
export const socket = io(window.location.origin, {
  transports: ['websocket', 'polling']
});

socket.on('connect_error', (error) => {
  console.error('Erreur de connexion Socket.IO:', error);
});
