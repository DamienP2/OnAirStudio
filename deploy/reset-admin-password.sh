#!/usr/bin/env bash
# OnAir Studio — réinitialisation du mot de passe admin
# Usage : sudo /opt/onair-studio/reset-admin-password.sh
#
# Prompt pour un nouveau mot de passe, le valide (double saisie + min 4 chars),
# l'écrit dans server/src/admin-password.json et redémarre le service.

set -euo pipefail

readonly APP_DIR="/opt/onair-studio"

# shellcheck source=deploy/lib/common.sh
source "${APP_DIR}/deploy/lib/common.sh"

if [[ $EUID -ne 0 ]]; then
    die "reset-admin-password.sh doit être exécuté en root (sudo)."
fi

LINUX_USER=$(stat -c '%U' "${APP_DIR}")

log_step "Réinitialisation du mot de passe admin OnAir Studio"

NEW_PASSWORD=$(prompt_password "Nouveau mot de passe admin")

PW_FILE="${APP_DIR}/server/src/admin-password.json"
printf '{\n  "password": %s\n}\n' "$(jq -Rn --arg pw "$NEW_PASSWORD" '$pw')" > "$PW_FILE"
chown "$LINUX_USER:$LINUX_USER" "$PW_FILE"
chmod 600 "$PW_FILE"
log_ok "Mot de passe écrit dans ${PW_FILE}"

log_info "Redémarrage du service onair-server"
systemctl restart onair-server.service
log_ok "Service redémarré — le nouveau mot de passe est actif"

# Invite à ré-authentifier dans les onglets ouverts
echo
log_info "Pense à te déconnecter et te reconnecter dans les navigateurs ouverts (clic 'Déconnexion' dans la top bar)."
