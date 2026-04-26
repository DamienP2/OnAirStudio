#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — désinstallation complète.
# Préserve : utilisateur Linux, config réseau (nmcli IP statique), paquets apt système.

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

uninstall_app() {
    local app_dir="${1:-/opt/onair-studio}"
    local kiosk_user="${LINUX_USER:-}"
    local kiosk_home="${LINUX_USER_HOME:-}"

    log_step "Désinstallation OnAir Studio"

    # 1. Stop + disable services systemd
    log_info "Arrêt des services systemd"
    systemctl stop onair-server.service onair-update.service 2>/dev/null || true
    systemctl disable onair-server.service onair-update.service 2>/dev/null || true
    rm -f /etc/systemd/system/onair-server.service \
          /etc/systemd/system/onair-update.service
    systemctl daemon-reload
    log_ok "Services arrêtés et supprimés"

    # 2. sudoers + udev rules
    if [[ -f /etc/sudoers.d/onair-update ]]; then
        rm -f /etc/sudoers.d/onair-update
        log_ok "sudoers onair-update supprimé"
    fi
    if [[ -f /etc/udev/rules.d/99-usbrelay.rules ]]; then
        rm -f /etc/udev/rules.d/99-usbrelay.rules
        udevadm control --reload-rules 2>/dev/null || true
        log_ok "Règle udev relais USB supprimée"
    fi

    # 3. App directory (templates, uploads, branding, settings, mots de passe)
    if [[ -d "$app_dir" ]]; then
        rm -rf "$app_dir"
        log_ok "$app_dir supprimé"
    fi

    # 4. Tmp clones et backups
    rm -rf /tmp/onair-install /tmp/onair-backup-* 2>/dev/null || true

    # 5. Autostart kiosk + dconf de l'utilisateur
    if [[ -n "$kiosk_user" && -d "$kiosk_home" ]]; then
        local autostart="$kiosk_home/.config/autostart/onair-display.desktop"
        local dconf_dir="$kiosk_home/.config/dconf"
        if [[ -f "$autostart" ]]; then
            rm -f "$autostart"
            log_ok "Autostart kiosk supprimé"
        fi
        if [[ -d "$dconf_dir" ]]; then
            rm -rf "$dconf_dir"
            log_ok "Configuration dconf utilisateur supprimée"
        fi
    fi

    log_ok "Désinstallation terminée"
    log_info "Préservés : utilisateur '$kiosk_user', config réseau, paquets apt"
}
