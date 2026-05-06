#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — setup de la clé SSH deploy et du Host SSH alias

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# Hôte SSH alias utilisé partout pour forcer l'utilisation de la clé deploy
readonly SSH_HOST_ALIAS="github-onair"

install_deploy_key() {
    log_step "Installation de la deploy key SSH"

    local src_key="${REPO_ROOT}/deploy/keys/onair_deploy"
    if [[ ! -f "$src_key" ]]; then
        die "Deploy key absente : $src_key (voir deploy/keys/README.md pour la générer)"
    fi

    local ssh_dir="${LINUX_USER_HOME}/.ssh"
    local dst_key="${ssh_dir}/onair_deploy"

    install -d -m 700 -o "$LINUX_USER" -g "$LINUX_USER" "$ssh_dir"
    install -m 600 -o "$LINUX_USER" -g "$LINUX_USER" "$src_key" "$dst_key"

    # known_hosts : ajoute github.com s'il n'y est pas
    local known_hosts="${ssh_dir}/known_hosts"
    if ! sudo -u "$LINUX_USER" ssh-keygen -F github.com -f "$known_hosts" >/dev/null 2>&1; then
        sudo -u "$LINUX_USER" ssh-keyscan -t rsa,ed25519 github.com 2>/dev/null | sudo -u "$LINUX_USER" tee -a "$known_hosts" >/dev/null
    fi
    chown "$LINUX_USER:$LINUX_USER" "$known_hosts"
    chmod 644 "$known_hosts"

    # Bloc Host dans ~/.ssh/config (idempotent)
    local ssh_config="${ssh_dir}/config"
    touch "$ssh_config"
    chmod 600 "$ssh_config"
    chown "$LINUX_USER:$LINUX_USER" "$ssh_config"

    if ! grep -q "^Host ${SSH_HOST_ALIAS}$" "$ssh_config" 2>/dev/null; then
        cat >> "$ssh_config" <<EOF

Host ${SSH_HOST_ALIAS}
    HostName github.com
    User git
    IdentityFile ${dst_key}
    IdentitiesOnly yes
EOF
        chown "$LINUX_USER:$LINUX_USER" "$ssh_config"
        log_ok "Host '${SSH_HOST_ALIAS}' ajouté à ~/.ssh/config"
    else
        log_ok "Host '${SSH_HOST_ALIAS}' déjà présent"
    fi

    # Test SSH (GitHub retourne exit code 1 mais avec un message "successfully authenticated")
    log_info "Test de la connexion SSH..."
    local ssh_output
    ssh_output=$(sudo -u "$LINUX_USER" ssh -o StrictHostKeyChecking=accept-new -T "$SSH_HOST_ALIAS" 2>&1 || true)
    if [[ "$ssh_output" == *"successfully authenticated"* ]]; then
        log_ok "Authentification GitHub OK"
    else
        log_error "Échec auth GitHub — sortie SSH :"
        echo "$ssh_output" >&2
        die "Vérifie la deploy key et sa présence sur GitHub."
    fi
}
