#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — installation services systemd, sudoers et udev

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

setup_systemd_services() {
    log_step "Installation des services systemd, sudoers et règles udev"

    local deploy_dir="${REPO_ROOT}/deploy"

    # Service principal — substitue __USER__ et __PORT__
    local listen_port="${LISTEN_PORT:-3333}"
    sed -e "s/__USER__/${LINUX_USER}/g" -e "s/__PORT__/${listen_port}/g" \
        "${deploy_dir}/onair-server.service" \
        > /etc/systemd/system/onair-server.service
    chmod 644 /etc/systemd/system/onair-server.service

    # Service oneshot pour update UI
    install -m 644 "${deploy_dir}/onair-update.service" /etc/systemd/system/onair-update.service

    systemctl daemon-reload
    systemctl enable onair-server.service
    systemctl enable onair-update.service  # enabled mais pas started (c'est un oneshot)
    systemctl restart onair-server.service
    log_ok "Services systemd activés"

    # Sudoers pour déclencher update depuis l'UI
    local sudoers_tmp
    sudoers_tmp=$(mktemp)
    sed "s/__USER__/${LINUX_USER}/g" "${deploy_dir}/sudoers-onair-update" > "$sudoers_tmp"
    if visudo -c -f "$sudoers_tmp"; then
        install -m 0440 -o root -g root "$sudoers_tmp" /etc/sudoers.d/onair-update
        log_ok "Sudoers onair-update installé"
    else
        rm -f "$sudoers_tmp"
        die "Syntaxe sudoers invalide — arrêt."
    fi
    rm -f "$sudoers_tmp"

    # Règle udev
    install -m 644 "${deploy_dir}/99-usbrelay.rules" /etc/udev/rules.d/99-usbrelay.rules
    udevadm control --reload-rules
    udevadm trigger
    log_ok "Règle udev USB-Relay installée"
}
