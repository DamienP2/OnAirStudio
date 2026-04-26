#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — création/validation de l'utilisateur Linux cible

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# setup_user → définit globalement LINUX_USER, crée si absent
setup_user() {
    log_step "Configuration de l'utilisateur Linux"

    # Défaut = user qui a lancé sudo (SUDO_USER), fallback "onairstudio"
    # si le script est exécuté en root direct (pas via sudo).
    local default_user="${SUDO_USER:-onairstudio}"
    # Sécurité : si SUDO_USER vaut 'root' (rare mais possible), on revient au fallback
    [[ "$default_user" == "root" ]] && default_user="onairstudio"

    LINUX_USER=$(prompt_default "Nom de l'utilisateur Linux qui fera tourner OnAir Studio" "$default_user")

    if id -u "$LINUX_USER" >/dev/null 2>&1; then
        log_ok "Utilisateur '$LINUX_USER' existe déjà"
    else
        log_info "Création de l'utilisateur '$LINUX_USER'..."
        local password
        password=$(prompt_password "Mot de passe pour '$LINUX_USER'")

        useradd -m -s /bin/bash "$LINUX_USER"
        echo "${LINUX_USER}:${password}" | chpasswd
        log_ok "Utilisateur créé"
    fi

    # Ajout aux groupes requis (idempotent)
    local groups=(sudo plugdev dialout systemd-journal)
    for g in "${groups[@]}"; do
        if getent group "$g" >/dev/null 2>&1; then
            usermod -aG "$g" "$LINUX_USER"
        else
            log_warn "Groupe '$g' absent, skip"
        fi
    done
    log_ok "Groupes assignés : ${groups[*]}"

    # Rendre LINUX_USER accessible au reste du script
    LINUX_USER_HOME=$(getent passwd "$LINUX_USER" | cut -d: -f6)
    export LINUX_USER LINUX_USER_HOME
}
