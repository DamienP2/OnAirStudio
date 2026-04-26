#!/usr/bin/env bash
# OnAir Studio — installeur automatique
# Usage : sudo ./install.sh
#
# Prérequis : Ubuntu Desktop 22.04 ou 24.04, connexion Internet.

set -euo pipefail

# REPO_URL : URL HTTPS publique du repo. Le clone est anonyme.
readonly REPO_URL="https://github.com/DamienP2/OnAirStudio.git"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export REPO_ROOT

# shellcheck source=deploy/lib/common.sh
source "${REPO_ROOT}/deploy/lib/common.sh"
# shellcheck source=deploy/lib/preflight.sh
source "${REPO_ROOT}/deploy/lib/preflight.sh"
# shellcheck source=deploy/lib/user.sh
source "${REPO_ROOT}/deploy/lib/user.sh"
# shellcheck source=deploy/lib/network.sh
source "${REPO_ROOT}/deploy/lib/network.sh"
# shellcheck source=deploy/lib/nodejs.sh
source "${REPO_ROOT}/deploy/lib/nodejs.sh"
# shellcheck source=deploy/lib/chrome.sh
source "${REPO_ROOT}/deploy/lib/chrome.sh"
# shellcheck source=deploy/lib/app-install.sh
source "${REPO_ROOT}/deploy/lib/app-install.sh"
# shellcheck source=deploy/lib/systemd-setup.sh
source "${REPO_ROOT}/deploy/lib/systemd-setup.sh"
# shellcheck source=deploy/lib/kiosk-setup.sh
source "${REPO_ROOT}/deploy/lib/kiosk-setup.sh"
# shellcheck source=deploy/lib/appliance-tweaks.sh
source "${REPO_ROOT}/deploy/lib/appliance-tweaks.sh"

install_reset_password_helper() {
    log_step "Installation du helper reset-admin-password.sh"
    install -m 755 "${REPO_ROOT}/deploy/reset-admin-password.sh" \
        "/opt/onair-studio/reset-admin-password.sh"
    log_ok "Helper installé : sudo /opt/onair-studio/reset-admin-password.sh"
}

on_error() {
    local exit_code=$?
    local line=${1:-?}
    log_error "Échec à la ligne ${line} (exit ${exit_code})."
    log_error "Consulte la sortie ci-dessus. Après correction, relance : sudo $0"
    exit "$exit_code"
}
trap 'on_error $LINENO' ERR

main() {
    echo
    # shellcheck disable=SC2059
    printf "${CLR_BOLD}━━━ OnAir Studio — Installer v1.0 ━━━${CLR_RESET}\n"
    echo

    run_preflight
    setup_user
    ADMIN_PASSWORD=$(prompt_password "Mot de passe admin de l'application")
    export ADMIN_PASSWORD

    # Identité du studio + serveur NTP — écrits dans custom-settings.json par app-install.sh
    STUDIO_NAME=$(prompt_default "Nom du studio" "OnAir Studio")
    export STUDIO_NAME
    NTP_SERVER=$(prompt_default "Serveur NTP" "pool.ntp.org")
    export NTP_SERVER
    # Fuseau horaire — appliqué au système (timedatectl) ET stocké pour le client
    TIMEZONE=$(prompt_default "Fuseau horaire (IANA, ex: Europe/Paris, America/New_York)" "Europe/Paris")
    export TIMEZONE
    # Langue de l'app
    LANGUAGE=$(prompt_default "Langue de l'application (fr/en)" "fr")
    export LANGUAGE

    # Port d'écoute — propose 3333, valide range + dispo
    while true; do
        LISTEN_PORT=$(prompt_default "Port d'écoute du serveur" "3333")
        if ! [[ "$LISTEN_PORT" =~ ^[0-9]+$ ]] || (( LISTEN_PORT < 1024 || LISTEN_PORT > 65535 )); then
            log_warn "Port invalide. Indique un nombre entre 1024 et 65535."
            continue
        fi
        # Vérifie si le port est déjà occupé (ss préféré, fallback netstat)
        if command_exists ss && ss -tln 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${LISTEN_PORT}\$"; then
            log_warn "Le port ${LISTEN_PORT} est déjà utilisé sur cette machine."
            confirm "Choisir un autre port ?" && continue
        fi
        break
    done
    export LISTEN_PORT

    setup_network

    log_step "Packages système (git, curl, jq, ca-certificates, gnupg)"
    # Désactive les sources cdrom:// qui plantent apt-get update
    # sur les installs depuis ISO (typique de Ubuntu Desktop fraîchement installé)
    if grep -qE '^deb cdrom:' /etc/apt/sources.list 2>/dev/null; then
        log_info "Désactivation des sources CD-ROM dans /etc/apt/sources.list"
        sed -i 's|^deb cdrom:|# deb cdrom:|' /etc/apt/sources.list
    fi
    apt-get update
    apt-get install -y git curl jq ca-certificates gnupg
    log_ok "Packages système OK"

    remove_update_notifier
    install_nodejs
    install_chrome
    install_app
    setup_systemd_services
    setup_kiosk
    apply_appliance_tweaks

    # Pare-feu : ouvre le port d'écoute si ufw est actif
    if command_exists ufw && ufw status 2>/dev/null | grep -q "Status: active"; then
        log_step "Ouverture du port ${LISTEN_PORT} dans ufw"
        ufw allow "${LISTEN_PORT}/tcp" >/dev/null
        log_ok "ufw : ${LISTEN_PORT}/tcp autorisé"
    else
        log_info "ufw inactif — pas d'ouverture de port nécessaire"
    fi

    # Helper de récupération admin
    install_reset_password_helper

    # Health check : le service répond-il ?
    log_step "Vérification du service (health check)"
    local ok=0
    for i in 1 2 3 4 5; do
        if curl -fsS --max-time 3 "http://localhost:${LISTEN_PORT}/api/timer/status" >/dev/null 2>&1; then
            ok=1; break
        fi
        sleep 2
    done
    if [[ "$ok" == "1" ]]; then
        log_ok "Service en écoute sur ${LISTEN_PORT}"
    else
        log_warn "Le service ne répond pas sur ${LISTEN_PORT} après 10s. Vérifie : journalctl -u onair-server -e"
    fi

    # Récap final
    echo
    # shellcheck disable=SC2059
    printf "${CLR_BOLD}${CLR_GREEN}━━━ Installation terminée ━━━${CLR_RESET}\n"
    echo
    # shellcheck disable=SC2059
    printf "  Contrôle : ${CLR_CYAN}http://%s:%s/control${CLR_RESET}\n" "${STATIC_IP:-?}" "${LISTEN_PORT}"
    # shellcheck disable=SC2059
    printf "  Affichage : ${CLR_CYAN}http://%s:%s/display${CLR_RESET}\n" "${STATIC_IP:-?}" "${LISTEN_PORT}"
    echo
    # shellcheck disable=SC2059
    printf "  Logs serveur :     ${CLR_BOLD}journalctl -u onair-server -f${CLR_RESET}\n"
    # shellcheck disable=SC2059
    printf "  Mise à jour :      ${CLR_BOLD}sudo /opt/onair-studio/update.sh${CLR_RESET}\n"
    # shellcheck disable=SC2059
    printf "  Reset mot de passe : ${CLR_BOLD}sudo /opt/onair-studio/reset-admin-password.sh${CLR_RESET}\n"
    echo
    # shellcheck disable=SC2059
    printf "  ${CLR_YELLOW}⚠ Redémarre la machine pour activer le kiosk Chrome.${CLR_RESET}\n"
    echo
}

main "$@"
