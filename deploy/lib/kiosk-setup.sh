#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — autostart Chrome kiosk + anti-veille GNOME

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

enable_auto_login() {
    log_info "Activation de l'auto-login GDM pour '${LINUX_USER}'"

    local gdm_conf=/etc/gdm3/custom.conf
    if [[ ! -f "$gdm_conf" ]]; then
        log_warn "GDM non détecté (${gdm_conf} absent) — auto-login non configuré. Le kiosk ne se lancera pas automatiquement."
        return 0
    fi

    # Backup (une seule fois — si déjà backuppé, on ne touche pas)
    if [[ ! -f "${gdm_conf}.onair-backup" ]]; then
        cp -a "$gdm_conf" "${gdm_conf}.onair-backup"
    fi

    # Nettoie les entrées AutomaticLogin* existantes pour repartir propre
    sed -i '/^AutomaticLoginEnable/d;/^AutomaticLogin=/d' "$gdm_conf"

    # Insère les 2 lignes juste après [daemon], ou crée la section si absente
    if grep -q '^\[daemon\]' "$gdm_conf"; then
        sed -i "/^\[daemon\]/a AutomaticLoginEnable=true\nAutomaticLogin=${LINUX_USER}" "$gdm_conf"
    else
        printf '\n[daemon]\nAutomaticLoginEnable=true\nAutomaticLogin=%s\n' "${LINUX_USER}" >> "$gdm_conf"
    fi

    log_ok "Auto-login GDM configuré pour '${LINUX_USER}'"
}

setup_kiosk() {
    log_step "Configuration du kiosk Chrome et anti-veille"

    local autostart_dir="${LINUX_USER_HOME}/.config/autostart"
    local desktop_src="${REPO_ROOT}/deploy/onair-display.desktop"
    local desktop_dst="${autostart_dir}/onair-display.desktop"

    install -d -m 755 -o "$LINUX_USER" -g "$LINUX_USER" "$autostart_dir"
    # Substitue __PORT__ dans le .desktop avant installation
    local listen_port="${LISTEN_PORT:-3333}"
    sed "s/__PORT__/${listen_port}/g" "$desktop_src" > "$desktop_dst"
    chown "$LINUX_USER:$LINUX_USER" "$desktop_dst"
    chmod 644 "$desktop_dst"
    log_ok "Autostart Chrome kiosk installé (port ${listen_port})"

    enable_auto_login

    # Anti-veille GNOME (exécuté en tant que user cible)
    # Le bus dbus peut ne pas être disponible à l'install (session graphique non démarrée),
    # on tente mais on n'échoue pas si ça ne marche pas.
    if sudo -u "$LINUX_USER" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u "$LINUX_USER")/bus" \
        gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null; then
        sudo -u "$LINUX_USER" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u "$LINUX_USER")/bus" \
            gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
        sudo -u "$LINUX_USER" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u "$LINUX_USER")/bus" \
            gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-timeout 0 2>/dev/null || true
        log_ok "Anti-veille GNOME appliquée"
    else
        log_warn "Anti-veille GNOME non appliquée (pas de session active). Applique manuellement après premier login :"
        log_warn "  gsettings set org.gnome.desktop.session idle-delay 0"
        log_warn "  gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'"
    fi
}
