#!/usr/bin/env bash
# OnAir Studio — mise à jour via git pull + rebuild conditionnel + restart
# Usage : sudo /opt/onair-studio/update.sh
#
# Déclenchable aussi via l'UI (Settings → Mise à jour) qui appelle :
#   systemctl start onair-update.service

set -euo pipefail

readonly APP_DIR="/opt/onair-studio"
BACKUP_DIR="/tmp/onair-backup-$(date +%Y%m%d-%H%M%S)"
readonly BACKUP_DIR

# shellcheck source=deploy/lib/common.sh
source "${APP_DIR}/deploy/lib/common.sh"

if [[ $EUID -ne 0 ]]; then
    die "update.sh doit être exécuté en root (sudo)."
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
    die "OnAir Studio n'est pas installé dans ${APP_DIR} — lance d'abord install.sh."
fi

# Déduire le user propriétaire
LINUX_USER=$(stat -c '%U' "${APP_DIR}")

log_step "Mise à jour OnAir Studio (user: ${LINUX_USER})"

# 1. Backup des 2 fichiers de données
log_info "Backup dans ${BACKUP_DIR}"
install -d -m 700 "$BACKUP_DIR"
for f in server/src/custom-settings.json server/src/admin-password.json; do
    if [[ -f "${APP_DIR}/${f}" ]]; then
        cp -a "${APP_DIR}/${f}" "${BACKUP_DIR}/"
    fi
done

# 2. Arrêt du service
log_info "Arrêt du service onair-server"
systemctl stop onair-server.service

# 3. Capture du hash avant
OLD_HASH=$(sudo -u "$LINUX_USER" git -C "$APP_DIR" rev-parse HEAD)

# 4. Fetch + reset --hard sur origin/main
# Tolérant aux divergences d'historique (force-push amont, orphan branch côté
# maintainer). Les données utilisateur (templates/, uploads/, branding/, *.json)
# sont gitignored donc reset --hard ne les touche pas.
log_info "git fetch + reset --hard origin/main (old: ${OLD_HASH:0:8})"
if ! sudo -u "$LINUX_USER" git -C "$APP_DIR" fetch origin 2>&1; then
    log_error "git fetch a échoué (réseau ou auth). Aucune modification appliquée."
    systemctl start onair-server.service
    die "Abandon."
fi
if ! sudo -u "$LINUX_USER" git -C "$APP_DIR" reset --hard origin/main 2>&1; then
    log_error "git reset --hard origin/main a échoué."
    systemctl start onair-server.service
    die "Abandon."
fi

NEW_HASH=$(sudo -u "$LINUX_USER" git -C "$APP_DIR" rev-parse HEAD)

if [[ "$OLD_HASH" == "$NEW_HASH" ]]; then
    log_ok "Déjà à jour (${OLD_HASH:0:8})"
    systemctl start onair-server.service
    exit 0
fi

log_info "Nouveau hash : ${NEW_HASH:0:8}"

# 5. Restauration des JSON si touchés (normalement gitignored, no-op)
for f in server/src/custom-settings.json server/src/admin-password.json; do
    if [[ -f "${BACKUP_DIR}/$(basename "$f")" ]] && [[ ! -f "${APP_DIR}/${f}" ]]; then
        cp -a "${BACKUP_DIR}/$(basename "$f")" "${APP_DIR}/${f}"
        chown "${LINUX_USER}:${LINUX_USER}" "${APP_DIR}/${f}"
        log_info "Restauration : ${f}"
    fi
done

# 6. Rebuild conditionnel
CHANGED=$(sudo -u "$LINUX_USER" git -C "$APP_DIR" diff --name-only "${OLD_HASH}" "${NEW_HASH}")

do_rollback() {
    log_warn "Rollback vers ${OLD_HASH:0:8}"
    sudo -u "$LINUX_USER" git -C "$APP_DIR" reset --hard "$OLD_HASH"
    (cd "${APP_DIR}/client" && sudo -u "$LINUX_USER" npm ci && sudo -u "$LINUX_USER" npm run build) || true
    (cd "${APP_DIR}/server" && sudo -u "$LINUX_USER" npm ci) || true
    systemctl start onair-server.service
}

trap 'log_error "Erreur lors du rebuild — rollback en cours"; do_rollback; exit 1' ERR

if echo "$CHANGED" | grep -q '^client/'; then
    log_info "Rebuild du client (npm ci + build)"
    (cd "${APP_DIR}/client" && sudo -u "$LINUX_USER" npm ci)
    (cd "${APP_DIR}/client" && sudo -u "$LINUX_USER" npm run build)
else
    log_info "Client inchangé — skip build"
fi

if echo "$CHANGED" | grep -q '^server/'; then
    log_info "Refresh des deps serveur (npm ci)"
    (cd "${APP_DIR}/server" && sudo -u "$LINUX_USER" npm ci)
else
    log_info "Server inchangé — skip npm ci"
fi

trap - ERR

# 7. Redémarrage
log_info "Redémarrage du service"
systemctl start onair-server.service

# 8. Health check — lit le port depuis l'unit systemd
LISTEN_PORT=$(systemctl show onair-server -p Environment 2>/dev/null \
    | tr ' ' '\n' | sed -n 's/^PORT=\([0-9]*\)$/\1/p' | head -n1)
LISTEN_PORT=${LISTEN_PORT:-3333}
log_info "Health check sur port ${LISTEN_PORT}"
for i in 1 2 3 4 5; do
    if curl -fsS "http://localhost:${LISTEN_PORT}/api/timer/status" >/dev/null 2>&1; then
        log_ok "Service répond sur ${LISTEN_PORT}"
        break
    fi
    if [[ "$i" == "5" ]]; then
        log_error "Le service ne répond pas après 10s — rollback"
        do_rollback
        exit 1
    fi
    sleep 2
done

# 9. Résumé
echo
log_step "Résumé de la mise à jour"
echo "  ${OLD_HASH:0:8} → ${NEW_HASH:0:8}"
echo
sudo -u "$LINUX_USER" git -C "$APP_DIR" log --oneline "${OLD_HASH}..${NEW_HASH}"
echo
log_ok "Mise à jour terminée avec succès"
