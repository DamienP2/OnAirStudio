# Deploy Keys — OnAir Studio

Ce dossier contient la paire de clés SSH utilisée par `install.sh` et `update.sh` pour cloner/puller le repo depuis GitHub.

## Fichiers

- `onair_deploy` : clé privée ed25519 (chmod 600)
- `onair_deploy.pub` : clé publique correspondante

## Première mise en place (une fois)

1. Générer une paire de clés ed25519 :

   ```bash
   ssh-keygen -t ed25519 -N "" -f deploy/keys/onair_deploy -C "onair-studio-deploy"
   ```

2. Ajouter `onair_deploy.pub` comme **Deploy key** du repo GitHub (Settings → Deploy keys → Add deploy key). **Cocher "Allow write access" = NON** (read-only).

3. Commit et push les deux fichiers.

## Rotation (si la clé est compromise ou pour rotation périodique)

1. **Révoquer l'ancienne clé** sur GitHub (Settings → Deploy keys → Remove).
2. Régénérer localement : `ssh-keygen -t ed25519 -N "" -f deploy/keys/onair_deploy -C "onair-studio-deploy-$(date +%Y%m%d)"`
3. Ajouter la nouvelle clé publique sur GitHub (étape 2 ci-dessus).
4. Commit + push.
5. Sur **chaque machine studio déjà installée**, faire un `sudo /opt/onair-studio/update.sh` pour récupérer la nouvelle clé **avant** de révoquer l'ancienne sur GitHub — sinon les machines ne pourront plus puller.

## Attention

- La clé privée est versionnée dans un repo privé. Si le repo fuite, la clé fuite. Assumé comme acceptable pour ce projet perso (lire le spec §2.2).
- La clé est **read-only** : impossible d'injecter du code malveillant via `git push` même en cas de fuite.
