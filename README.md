# OnAir Studio

Système de **timer & display** professionnel pour studios radio et TV.
Pilotage du chrono d'antenne, panneau ON AIR via relais USB, designer de
templates drag-and-drop, intégration calendriers (Google / Microsoft /
Apple iCloud), flux vidéo NDI, contrôle distant via Stream Deck.

> Application web full-stack (Node.js + React) prévue pour tourner sur une
> machine dédiée du studio (mini-PC, Raspberry Pi 4/5, Intel NUC…) sous
> **Ubuntu Desktop 22.04 ou 24.04 LTS**.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Prérequis matériels & logiciels](#prérequis-matériels--logiciels)
- [Installation automatisée (recommandée)](#installation-automatisée-recommandée)
- [Installation manuelle (pas-à-pas)](#installation-manuelle-pas-à-pas)
- [Configuration post-installation](#configuration-post-installation)
- [Mise à jour](#mise-à-jour)
- [Sauvegarde & restauration](#sauvegarde--restauration)
- [Architecture](#architecture)
- [API REST (intégration Companion / Stream Deck)](#api-rest-intégration-companion--stream-deck)
- [Dépannage](#dépannage)
- [Licence](#licence)

---

## Fonctionnalités

### Chrono d'antenne
- Timer chrono décroissant avec temps restant + temps écoulé
- Pause / Reprise / Arrêt avec confirmation
- Marquage de **parties (laps)** en cours d'émission
- Préréglages de durée personnalisables (12, 26, 52 min, etc.)
- **Arrêt automatique après dépassement** — filet de sécurité configurable
  via cadran circulaire dans Réglages : si l'opérateur oublie d'arrêter, le
  chrono + relais ON AIR s'arrêtent seuls après N minutes (par défaut 60).
  Réglable de 0 (désactivé) à 180 min.

### Affichage studio (display)
- URL `/display` plein écran à projeter sur l'écran du studio
- Synchronisation temps réel multi-écrans via Socket.IO
- Bascule automatique entre 2 templates selon l'état du chrono :
  - **Mode actif** (chrono actif)
  - **Mode veille** (chrono à l'arrêt)

### Designer de templates (V3)
- Éditeur visuel **drag-and-drop** : horloges analogique/numérique, badge ON AIR, texte dynamique avec variables, logo, image, vidéo, planning, formes, barres et anneaux de progression…
- **Templates par catégorie** : `horloge` ou `veille` — un template ne peut être activé que sur le slot compatible
- **Modèles factory** prêts à l'emploi : 2 horloges, 3 horloges, veille
- Snap automatique, repères système (¼/½/¾, marges 25 px), grille configurable
- Auto-save 1.2 s + Ctrl+Z/Y groupés (drag-scrub = 1 entrée undo)
- Format canvas libre (16:9, 21:9, 4:3, 1:1, 9:16, 3:4 ou custom)

### Palette de couleurs partagée
- Liste de couleurs au format `#RRGGBBAA` (avec transparence)
- Disponible dans **tous les color pickers** du designer
- 5 couleurs broadcast par défaut (Blanc, Gris, Noir, Rouge ON AIR, Bleu studio)

### Calendriers (widget Planning)
- **Google Calendar** (OAuth 2.0)
- **Microsoft 365 / Outlook** (Azure AD)
- **Apple iCloud** (CalDAV avec mot de passe d'application)
- Tokens chiffrés en **AES-256-GCM**, polling 5 min, multi-comptes
- Filtrage par calendrier, mot-clé, lieu, organisateur, statut

### Vidéo
- **YouTube** : embed direct
- **Fichier uploadé** : MP4 / WebM
- **Flux NDI** live (mDNS auto-discovery, sous-processus isolé)

### ON AIR — relais USB
- Pilotage direct d'une lampe rouge via relais USB-Relay-1
- Support **multi-canaux** (1, 2, 4, 8) avec test latch dans Réglages
- Hot-plug détecté en live, indicateur visuel dans l'UI

### Sécurité & administration
- Mot de passe admin pour Design / Calendriers / Réglages
- Réinitialisation à 3 niveaux : Données / Réglages / Tout
- Mises à jour OTA (Over-The-Air) depuis l'interface

### Intégration Stream Deck / Companion
- API REST complète pour déclencher start/stop/pause/lap/onair depuis un
  contrôleur physique (Bitfocus Companion ou plugin natif)

---

## Prérequis matériels & logiciels

### Matériel

| Composant | Minimum | Recommandé |
|---|---|---|
| OS | Ubuntu Desktop 22.04 LTS | Ubuntu Desktop 24.04 ou 26.04 LTS |
| CPU | x86_64 ou ARM64 (RPi 4) | RPi 5 / Intel NUC i3+ |
| RAM | 2 Go | 4 Go+ |
| Disque | 8 Go libres | 16 Go SSD |
| Réseau | Ethernet recommandé | LAN avec mDNS multicast (NDI) |
| Sortie vidéo | HDMI 1080p | HDMI 1080p ou 4K |
| Périphériques | — | Relais USB-Relay-1 (VID `16c0`, PID `05df`) |

> ⚠ **Ubuntu Server n'est pas supporté** — le système nécessite un environnement graphique pour le mode kiosk Chrome qui projette le display.

### À faire AVANT de lancer le script

Sur un Ubuntu fraîchement installé (surtout **26.04** qui ne préinstalle plus `curl`), exécute ces étapes une fois :

```bash
# 1. Mettre à jour les paquets système
sudo apt update && sudo apt upgrade -y

# 2. Installer les outils de base nécessaires au script d'install
sudo apt install -y curl git ca-certificates openssh-server

# 3. (Optionnel mais recommandé) Activer SSH si tu veux administrer à distance
sudo systemctl enable --now ssh
sudo ufw allow ssh   # si ufw est actif

# 4. Vérifier la connectivité (DNS + HTTPS)
curl -fsSI https://github.com >/dev/null && echo "Internet OK"

# 5. Vérifier l'heure système (sinon les certificats HTTPS échoueront)
date
sudo timedatectl set-ntp true   # active la sync NTP système si besoin
```

> ℹ Si tu n'as pas encore SSH activé, fais l'install directement sur la machine. Une fois OnAir Studio installé, tu peux administrer via l'UI web sans avoir besoin de SSH au quotidien.

### Logiciels installés automatiquement par le script

- **Node.js 22 LTS** (via NodeSource)
- **Google Chrome** (repo officiel Google)
- **NetworkManager** (pour la config IP statique)
- **ffmpeg** — capture x11grab pour la sortie vidéo
- Build tools (`build-essential`, `python3` — nécessaires pour les modules natifs comme `@balena/usbrelay`)
- `jq` (parsing JSON dans les scripts d'install/update)
- `chrony` (NTP) — déjà présent sur Ubuntu Desktop par défaut

---

## Installation automatisée (recommandée)

### En une commande 

```bash
git clone https://github.com/DamienP2/OnAirStudio.git /tmp/onair-install
cd /tmp/onair-install
sudo ./launch.sh
```

### Pendant l'exécution

Le script pose 3 questions :

1. **Utilisateur Linux** qui fera tourner le service (défaut : `onairstudio`).
   Si l'utilisateur n'existe pas, il est créé avec un mot de passe à choisir.
2. **Mot de passe admin de l'application** (à utiliser dans l'UI pour
   accéder aux onglets protégés et déclencher des mises à jour).
3. **Configuration réseau** :
   - L'interface active est détectée (ex : `enp3s0`)
   - Vous fournissez : adresse IP/masque (ex `192.168.1.50/24`), passerelle, DNS
   - L'IP devient **statique** via `nmcli` (NetworkManager)

**Durée typique** : 5 à 10 min selon la connexion internet.

### Ce que fait le script en détail

1. **Vérifie l'environnement** : Ubuntu Desktop, espace disque, accès Internet
2. **Crée l'utilisateur Linux** (groupes `sudo`, `plugdev`, `dialout`, `systemd-journal`)
3. **Installe Node.js 22 LTS** via NodeSource
4. **Installe Google Chrome** depuis le repo officiel `.deb`
5. **Configure l'IP statique** via NetworkManager
6. **Clone le projet** dans `/opt/onair-studio`
7. **`npm ci` + build React** côté client + dépendances serveur
8. **Crée le service systemd** `onair-server.service` (auto-démarrage au boot)
9. **Installe les règles udev** pour le relais USB (accès non-root)
10. **Configure l'autostart Chrome kiosk** (fichier `.desktop` dans `~/.config/autostart/`)
11. **Désactive la veille écran GNOME** et `update-notifier` (interférent avec le kiosk)

### Après l'installation

1. **Redémarrez la machine** (`sudo reboot`).
2. Au boot, Chrome s'ouvre automatiquement en plein écran sur l'URL `/display`.
3. Depuis un autre poste du réseau, accédez au panneau de contrôle :
   `http://<ip-statique>:3333/control`
4. Ouvrez l'onglet **Réglages** et déverrouillez avec le mot de passe admin.
5. Personnalisez : nom du studio, fuseau horaire, NTP, palette, etc.
6. Allez dans **Design** pour créer votre premier template et l'activer.

---

## Installation manuelle (pas-à-pas)

Pour comprendre ce que fait le script, ou pour ajuster certaines étapes
(par ex. installation sans IP statique). Toutes les commandes sont à
exécuter en `sudo` ou en tant qu'utilisateur ayant les droits.

### 1. Mise à jour système

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential python3 ca-certificates gnupg
```

### 2. Node.js 22 LTS (NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # → v22.x.x
npm --version
```

### 3. Google Chrome

```bash
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
echo 'deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main' | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update && sudo apt install -y google-chrome-stable
```

### 4. Utilisateur dédié au service

```bash
sudo adduser onairstudio
sudo usermod -aG sudo,plugdev,dialout,systemd-journal onairstudio
```

### 5. Clone du projet

```bash
sudo mkdir -p /opt/onair-studio
sudo chown onairstudio:onairstudio /opt/onair-studio
sudo -u onairstudio git clone https://github.com/DamienP2/OnAirStudio.git /opt/onair-studio
cd /opt/onair-studio
```

### 6. Build & dépendances

```bash
# Client React
cd /opt/onair-studio/client
sudo -u onairstudio npm ci
sudo -u onairstudio npm run build

# Serveur
cd /opt/onair-studio/server
sudo -u onairstudio npm ci
```

### 7. Service systemd

Créer `/etc/systemd/system/onair-server.service` :

```ini
[Unit]
Description=OnAir Studio Server
After=network.target

[Service]
Type=simple
User=onairstudio
WorkingDirectory=/opt/onair-studio/server
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3333

[Install]
WantedBy=multi-user.target
```

Activer :
```bash
sudo systemctl daemon-reload
sudo systemctl enable onair-server
sudo systemctl start onair-server
sudo systemctl status onair-server  # → "active (running)"
```

### 8. Règles udev pour le relais USB

Créer `/etc/udev/rules.d/50-onair-relay.rules` :

```
SUBSYSTEM=="usb", ATTRS{idVendor}=="16c0", ATTRS{idProduct}=="05df", MODE="0666", GROUP="plugdev"
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="16c0", ATTRS{idProduct}=="05df", MODE="0666", GROUP="plugdev"
```

Recharger :
```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### 9. Autostart Chrome kiosk

En tant qu'utilisateur `onairstudio` :

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/onair-display.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=OnAir Display
Exec=google-chrome --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-features=TranslateUI --autoplay-policy=no-user-gesture-required http://localhost:3333/display
X-GNOME-Autostart-enabled=true
EOF
```

### 10. Désactiver la veille écran (GNOME)

```bash
gsettings set org.gnome.desktop.session idle-delay 0
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing'
gsettings set org.gnome.desktop.screensaver lock-enabled false
```

### 11. (Optionnel) IP statique via nmcli

```bash
# Lister les interfaces actives
nmcli connection show --active

# Configurer en statique (adapter le nom de connexion)
sudo nmcli connection modify "Wired connection 1" \
  ipv4.method manual \
  ipv4.addresses 192.168.1.50/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "1.1.1.1 9.9.9.9"
sudo nmcli connection up "Wired connection 1"
```

### 12. (Optionnel) Support NDI

Le module `grandiose` (binding NDI) est installé automatiquement via
`npm ci`, mais nécessite que le **NDI SDK 6** soit présent à la compilation.
Si l'install des dépendances échoue, télécharger le SDK depuis le site
officiel NewTek puis relancer `npm ci`.

---

## Configuration post-installation

### Mot de passe admin

Le premier mot de passe est configuré par le script. Pour le changer :
**Réglages → Sécurité** → saisir le nouveau, confirmer. Tu seras déconnecté.

### Heure & NTP

**Réglages → Heure & NTP** :
- Choisir le **fuseau horaire** (Europe/Paris par défaut)
- 3 serveurs NTP avec fallback automatique (priorité ordonnée)
- Voyant vert sur le serveur actif

### Palette de couleurs

**Réglages → Palette de couleurs** :
- 5 couleurs broadcast par défaut (Blanc / Gris / Noir / Rouge ON AIR / Bleu studio)
- Ajouter / supprimer librement
- Format `#RRGGBBAA` (transparence supportée)

### Calendriers

#### Google Calendar
1. Créer un projet sur [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Activer l'**API Google Calendar**
3. Créer un **ID client OAuth 2.0** type « Application Web »
4. Coller l'URI de redirection affichée dans l'UI (ex : `http://192.168.1.50:3333/api/calendar/google/callback`)
5. Saisir Client ID + Secret dans **Calendriers → Google → Configurer**
6. Cliquer **Connecter** pour autoriser un compte

#### Microsoft 365
1. Inscrire une app sur [Azure AD App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Permissions API déléguées : `Calendars.Read`, `Calendars.Read.Shared`, `User.Read`, `offline_access`
3. Coller l'URI de redirection
4. Tenant : `common` pour multi-tenant + comptes perso

#### Apple iCloud
1. Générer un **mot de passe pour application** sur [account.apple.com](https://account.apple.com/account/manage)
2. Bouton **Ajouter Apple** dans Calendriers → saisir Apple ID + le mot de passe d'application

### Templates & catégories

Chaque template a une catégorie : `horloge` (chrono actif) ou `veille`
(chrono à l'arrêt). Le bouton **Activer** dans le designer ne propose que
le slot compatible. Côté Contrôle, le toggle Preview filtre la liste
selon le mode.

### Relais ON AIR

**Réglages → Panneaux ON AIR** :
- Type : USB (Ethernet en dev)
- **Nombre de canaux** : 1 / 2 / 4 / 8 (selon la carte physique)
- **Test latch** : un bouton par canal pour vérifier le câblage en direct

---

## Mise à jour

### Via l'interface (recommandé)

**Réglages → Mise à jour** :
1. Saisir le mot de passe admin
2. **Vérifier les mises à jour**
3. Si dispo : **Mettre à jour maintenant** → confirmation modale

> Le service redémarre (~30 à 60 s d'interruption). Le bouton est grisé si
> le timer tourne — assurez-vous que le studio n'est pas en antenne.

### Via CLI (sur la machine)

```bash
sudo /opt/onair-studio/update.sh
```

### Préservation des données

Les fichiers suivants sont **gitignorés** et préservés à chaque mise à jour :

- `server/src/custom-settings.json` — réglages perso (NTP, palette, fuseau, presets, etc.)
- `server/src/admin-password.json` — mot de passe admin (en clair, fichier chmod 600)
- `server/src/templates/*.json` — templates créés
- `server/src/uploads/` — images / vidéos uploadées
- `server/src/branding/` — logo personnalisé
- `server/src/calendar-accounts.json` + `calendar-credentials.json` — comptes calendriers + credentials OAuth (chiffrés)

---

## Sauvegarde & restauration

### Sauvegarde manuelle

Tout l'état utilisateur est dans `/opt/onair-studio/server/src/` (hors du
code git). Sauvegarder :

```bash
sudo tar czf /tmp/onair-backup-$(date +%F).tar.gz -C /opt/onair-studio/server/src \
  custom-settings.json admin-password.json \
  templates uploads branding \
  calendar-accounts.json calendar-credentials.json 2>/dev/null
```

### Restauration

Sur une nouvelle install fraîche :

```bash
sudo systemctl stop onair-server
sudo tar xzf onair-backup-YYYY-MM-DD.tar.gz -C /opt/onair-studio/server/src/
sudo chown -R onairstudio:onairstudio /opt/onair-studio/server/src/
sudo systemctl start onair-server
```

### Réinitialisation depuis l'UI

**Réglages → Réinitialisation** propose 3 niveaux :
- **Données** : templates + uploads + comptes calendriers connectés (factory + credentials OAuth conservés)
- **Réglages par défaut** : nom, langue, fuseau, NTP, relais, palette (mot de passe + templates conservés)
- **Tout réinitialiser** : combine les deux + logo personnalisé + credentials OAuth (seul le mot de passe admin reste)

---

## Architecture

### Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + react-moveable |
| Backend | Node.js 22 + Express + Socket.IO |
| Persistance | Fichiers JSON locaux (pas de DB) |
| Temps réel | Socket.IO (broadcast multi-clients) |
| Relais USB | `@balena/usbrelay` (HID raw) |
| NDI | `grandiose` (binding C++) en sous-processus isolé |
| OAuth | AES-256-GCM pour les tokens, HMAC-signed state |
| Calendriers Apple | CalDAV (PROPFIND / REPORT XML) |
| mDNS | `bonjour-service` pour la découverte NDI |

### Structure du dépôt

```
OnAirStudio/
├── client/               React app (interface utilisateur)
│   ├── src/
│   │   ├── panels/       Contrôle, Design, Calendriers, Réglages, Aide
│   │   ├── designer/     Inspector, Canvas, Palette, Toolbar
│   │   ├── template-objects/  Horloge, Texte, Vidéo, Planning, etc.
│   │   ├── components/   Header, ColorPicker, OptionGroup, Dialog…
│   │   └── store/        TimerContext, PaletteContext, templateStore
│   └── dist/             Build production (généré par `npm run build`)
├── server/
│   └── src/
│       ├── index.js      Entrypoint Express + Socket.IO
│       ├── config.js     Settings par défaut + persistance
│       ├── templates-manager.js
│       ├── factory-templates/    Modèles fournis (2-horloges, 3-horloges, veille)
│       ├── uploads-manager.js
│       ├── calendar/     google.js, microsoft.js, caldav.js, storage.js
│       └── video/        ndi.js, ndi-worker.js, ndi-discover.js
├── install.sh            Script d'install Ubuntu
├── update.sh             Script de mise à jour OTA
└── README.md             ← vous êtes ici
```

### Données runtime (ignorées par git)

```
server/src/
├── custom-settings.json     Réglages utilisateur
├── admin-password.json      Mot de passe admin (en clair, chmod 600)
├── templates/*.json         Templates créés par l'utilisateur
├── uploads/                 Images / vidéos uploadées (+ index.json)
├── branding/logo.{png,jpg,svg}  Logo personnalisé
├── calendar-credentials.json Credentials OAuth (chiffrés)
└── calendar-accounts.json   Comptes connectés (tokens chiffrés)
```

---

## API REST (intégration Companion / Stream Deck)

Toutes les actions sont des **POST** sur le port 3333. Selon la
configuration, certains endpoints peuvent exiger un header
`X-Admin-Password: <mot-de-passe>`.

### Timer

| Action | Endpoint |
|---|---|
| Démarrer | `POST /api/timer/start` |
| Pause | `POST /api/timer/pause` |
| Reprendre | `POST /api/timer/resume` |
| Arrêter | `POST /api/timer/stop` |
| Marquer un intermédiaire | `POST /api/timer/lap` |
| Définir une durée | `POST /api/timer/duration?value=00:26:00` |

### ON AIR

| Action | Endpoint |
|---|---|
| Activer | `POST /api/onair/on` |
| Éteindre | `POST /api/onair/off` |
| Toggle | `POST /api/onair/toggle` |

### Templates

| Action | Endpoint |
|---|---|
| Lister | `GET /api/templates` |
| Récupérer | `GET /api/templates/:id` |
| Template actif (mode) | `GET /api/templates/active?mode=running\|stopped` |

### Exemple Companion (HTTP Request)

URL : `http://192.168.1.50:3333/api/timer/start`
Method : `POST`
Headers : `X-Admin-Password: monMotDePasse`

Voir l'onglet **Aide → Stream Deck** dans l'app pour la liste complète et
des exemples de presets (bouton 26 min combiné, bouton panique, etc.).

---

## Dépannage

### Le service ne démarre pas

```bash
sudo systemctl status onair-server
journalctl -u onair-server -n 50
```

Causes courantes :
- Port 3333 déjà utilisé → changer `Environment=PORT=` dans le service
- Permissions manquantes sur `/opt/onair-studio` → `chown -R onairstudio:onairstudio`
- Module natif compilé pour une autre version Node → `cd server && npm rebuild`

### Le bouton ON AIR est grisé

Le relais USB n'est pas détecté.
1. Vérifier le branchement physique
2. `lsusb | grep 16c0` doit lister le périphérique
3. Vérifier les règles udev (étape 8 ci-dessus) et redémarrer
4. Statut visible dans **Réglages → Panneaux ON AIR**

### NTP désynchronisé

```bash
chronyc sources    # voir les serveurs interrogés
chronyc tracking   # voir l'écart actuel
```

Si pool.ntp.org est bloqué par le réseau studio, changer le serveur
principal dans **Réglages → Heure & NTP**.

### Chrome kiosk ne démarre pas au boot

- Vérifier que le fichier `~/.config/autostart/onair-display.desktop` existe
- Tester manuellement : `google-chrome --kiosk http://localhost:3333/display`
- Logs : `~/.cache/google-chrome/`

### Vidéo NDI ne trouve aucune source

- Vérifier qu'au moins un encodeur NDI émet sur le LAN
- Le routeur ne doit **pas filtrer le multicast** (mDNS)
- Logs serveur : `journalctl -u onair-server | grep -i ndi`

### OAuth Google : `redirect_uri_mismatch`

L'URI de redirection enregistrée dans Google Cloud doit correspondre
exactement à celle affichée dans **Calendriers → Google → URI de
redirection** (incluant le port et le chemin).

### Force-réinitialisation depuis le terminal

Si l'UI est inaccessible :

```bash
sudo systemctl stop onair-server
sudo rm /opt/onair-studio/server/src/custom-settings.json
sudo rm /opt/onair-studio/server/src/admin-password.json  # ⚠ supprime le mot de passe admin
sudo systemctl start onair-server
```

Au prochain démarrage, l'app retombe sur les valeurs par défaut.

---

## Licence

Propriétaire — utilisation interne. Voir le contrat de licence pour les
conditions d'utilisation et de redistribution.

---

## Crédits

Made with ❤️ — issue tracker : [GitHub Issues](https://github.com/DamienP2/OnAirStudio/issues)
