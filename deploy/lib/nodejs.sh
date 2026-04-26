#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — installation Node.js 22 LTS via NodeSource

# shellcheck source=common.sh
set -o pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

readonly NODE_MAJOR=22

install_nodejs() {
    log_step "Installation de Node.js ${NODE_MAJOR} LTS"

    # Idempotence : si Node ${NODE_MAJOR}.x déjà installé, skip
    if command_exists node; then
        local current_major
        current_major=$(node -v | sed -E 's/^v([0-9]+)\..*/\1/')
        if [[ "$current_major" == "$NODE_MAJOR" ]]; then
            log_ok "Node.js $(node -v) déjà installé"
            return 0
        fi
        log_warn "Node.js $(node -v) présent, installation de la v${NODE_MAJOR}..."
    fi

    # Ajout du repo NodeSource
    local keyring=/usr/share/keyrings/nodesource.gpg
    if ! curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor --yes -o "$keyring"; then
        die "Échec du téléchargement ou du dearmor de la clé GPG NodeSource"
    fi
    [[ -s "$keyring" ]] || die "Keyring NodeSource vide ou absent : $keyring"
    chmod 644 "$keyring"

    echo "deb [signed-by=${keyring}] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list

    apt-get update
    apt-get install -y nodejs

    log_ok "Node.js $(node -v) / npm $(npm -v) installé"
}
