import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Version de l'app — lue depuis le package.json racine (source de vérité).
// Injectée dans le bundle via `define` (cf. plus bas) pour être affichée dans l'UI.
const __dirnameLocal = dirname(fileURLToPath(import.meta.url))
const rootPkg = JSON.parse(readFileSync(join(__dirnameLocal, '..', 'package.json'), 'utf8'))
const APP_VERSION = rootPkg.version || 'dev'

// En dev : Vite (5173) proxifie /api, /uploads et /socket.io vers le serveur Node (3333).
// Comme ça le client utilise des URLs relatives et marche aussi bien en dev qu'en prod.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION)
  },
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3333',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://127.0.0.1:3333',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3333',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
