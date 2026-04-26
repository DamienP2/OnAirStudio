#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — détection de l'utilisateur courant (sudo) comme propriétaire.
# On ne crée plus d'utilisateur dédié : on utilise celui qui a invoqué sudo.
# Ça simplifie l'exploitation et évite de gérer un mot de passe supplémentaire.

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

setup_user() {
    log_step "Détection de l'utilisateur courant"

    if [[ -z "${SUDO_USER:-}" || "$SUDO_USER" == "root" ]]; then
        die "Ce script doit être lancé via sudo depuis un utilisateur normal (pas en root direct).
   Exemple : sudo ./launch.sh (depuis ta session habituelle)"
    fi

    LINUX_USER="$SUDO_USER"

    if ! id -u "$LINUX_USER" >/dev/null 2>&1; then
        die "Utilisateur '$LINUX_USER' introuvable (incohérence sudo)."
    fi

    LINUX_USER_HOME=$(getent passwd "$LINUX_USER" | cut -d: -f6)
    if [[ -z "$LINUX_USER_HOME" || ! -d "$LINUX_USER_HOME" ]]; then
        die "Home directory introuvable pour '$LINUX_USER'."
    fi

    log_ok "Utilisateur cible : ${LINUX_USER} (home : ${LINUX_USER_HOME})"

    # Ajout aux groupes requis pour USB relais + journal systemd (idempotent).
    # Pas besoin de 'sudo' : l'utilisateur en est déjà membre puisqu'il a invoqué sudo.
    local groups=(plugdev dialout systemd-journal)
    for g in "${groups[@]}"; do
        if getent group "$g" >/dev/null 2>&1; then
            if ! id -nG "$LINUX_USER" | grep -qw "$g"; then
                usermod -aG "$g" "$LINUX_USER"
                log_info "Ajouté au groupe : $g"
            fi
        fi
    done

    export LINUX_USER LINUX_USER_HOME
}
