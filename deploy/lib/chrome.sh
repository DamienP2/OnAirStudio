#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — installation Google Chrome stable .deb

# shellcheck source=common.sh
set -o pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

install_chrome() {
    log_step "Installation de Google Chrome"

    if command_exists google-chrome; then
        log_ok "Google Chrome déjà installé ($(google-chrome --version))"
        return 0
    fi

    local keyring=/usr/share/keyrings/google-chrome.gpg
    if ! curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
        | gpg --dearmor --yes -o "$keyring"; then
        die "Échec du téléchargement ou du dearmor de la clé GPG Google"
    fi
    [[ -s "$keyring" ]] || die "Keyring Google vide ou absent : $keyring"
    chmod 644 "$keyring"

    echo "deb [arch=amd64 signed-by=${keyring}] https://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list

    apt-get update
    apt-get install -y google-chrome-stable

    log_ok "Chrome installé ($(google-chrome --version))"
}

remove_update_notifier() {
    log_step "Désinstallation de update-notifier (évite les popups en kiosk)"
    apt-get remove -y update-notifier update-notifier-common 2>/dev/null || true
    log_ok "update-notifier retiré (si présent)"
}
