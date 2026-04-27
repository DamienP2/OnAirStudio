#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — durcissements pour un poste studio "appliance"
# (désactive veille/suspend, auto-updates, snap refresh, dconf sleep)

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

set_timezone() {
    # Force la timezone système (affichage horloge + logs systemd à l'heure locale).
    # Lit la variable d'env TIMEZONE (passée par install.sh), fallback sur Europe/Paris.
    local target_tz="${TIMEZONE:-Europe/Paris}"
    local current_tz
    current_tz=$(timedatectl show --property=Timezone --value 2>/dev/null || echo "unknown")

    if [[ "$current_tz" == "$target_tz" ]]; then
        log_ok "Timezone déjà sur ${target_tz}"
    else
        log_info "Timezone actuelle : ${current_tz} → passage à ${target_tz}"
        timedatectl set-timezone "$target_tz" 2>/dev/null \
            || log_warn "Échec set-timezone — vérifie que '${target_tz}' est un IANA valide"
    fi
    # Active aussi la synchro NTP systemd (belt-and-suspenders)
    timedatectl set-ntp true 2>/dev/null || true
    log_ok "Timezone : $(timedatectl show --property=Timezone --value 2>/dev/null || echo unknown)"
}

disable_sleep_and_suspend() {
    log_info "Désactivation des cibles systemd sleep/suspend/hibernate"
    systemctl mask \
        sleep.target \
        suspend.target \
        hibernate.target \
        hybrid-sleep.target \
        >/dev/null 2>&1 || true
    log_ok "Veille systemd désactivée"
}

disable_auto_updates() {
    log_info "Désactivation des mises à jour automatiques apt"

    # Timers apt-daily (check périodique de nouveaux paquets)
    systemctl disable --now apt-daily.timer apt-daily-upgrade.timer >/dev/null 2>&1 || true
    systemctl mask apt-daily.service apt-daily-upgrade.service >/dev/null 2>&1 || true

    # Service unattended-upgrades (applique auto les security updates)
    systemctl disable --now unattended-upgrades.service >/dev/null 2>&1 || true

    # Désinstalle le paquet si présent (ceinture + bretelles)
    apt-get remove -y unattended-upgrades >/dev/null 2>&1 || true

    # Force la conf apt à ne rien faire d'automatique
    cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "0";
APT::Periodic::Download-Upgradeable-Packages "0";
APT::Periodic::AutocleanInterval "0";
APT::Periodic::Unattended-Upgrade "0";
EOF

    log_ok "Mises à jour automatiques apt désactivées"
}

disable_snap_refresh() {
    if ! command_exists snap; then
        log_info "snapd absent — skip"
        return 0
    fi

    log_info "Report des refresh snap (éviter les redémarrages intempestifs)"
    # Maintient les snaps tels quels pendant 60 jours glissants
    snap set system refresh.hold="$(date -u -d '+60 days' +%Y-%m-%dT%H:%M:%SZ)" >/dev/null 2>&1 || true
    log_ok "Refresh snap différé"
}

configure_dconf_defaults_for_user() {
    # Applique les paramètres GNOME de manière PERSISTANTE via dconf profile utilisateur.
    # Plus fiable que gsettings (qui nécessite une session active).
    log_info "Durcissement GNOME (veille écran + écran de verrouillage) pour '${LINUX_USER}'"

    local dconf_dir="${LINUX_USER_HOME}/.config/dconf"
    local dconf_profile_dir="${LINUX_USER_HOME}/.config/dconf/profile"
    install -d -m 755 -o "$LINUX_USER" -g "$LINUX_USER" "$dconf_dir"
    install -d -m 755 -o "$LINUX_USER" -g "$LINUX_USER" "$dconf_profile_dir"

    # On préfère écrire via `sudo -u USER dbus-run-session gsettings` qui crée une session
    # éphémère sans nécessiter de desktop actif.
    if command_exists dbus-run-session; then
        sudo -u "$LINUX_USER" dbus-run-session -- bash -c '
            gsettings set org.gnome.desktop.session idle-delay 0
            gsettings set org.gnome.desktop.screensaver lock-enabled false
            gsettings set org.gnome.desktop.screensaver idle-activation-enabled false
            gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type nothing
            gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-timeout 0
            gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type nothing
            gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-timeout 0
        ' >/dev/null 2>&1 || log_warn "gsettings partiels (certains peuvent avoir échoué)"
        log_ok "GNOME : veille/verrouillage désactivés pour '${LINUX_USER}'"
    else
        log_warn "dbus-run-session absent — règle les paramètres d'énergie manuellement après premier login"
    fi
}

configure_grub_silent_boot() {
    # Boot direct sans menu — un poste studio doit redémarrer en 100%
    # autonome. Sans ces réglages, Ubuntu affiche le menu GRUB et BLOQUE
    # tant qu'on n'appuie pas Entrée si le boot précédent a été interrompu
    # (flag `recordfail`). Inacceptable pour un kiosk en production.
    log_info "Configuration de GRUB pour un boot silencieux (kiosk)"

    local grub_default="/etc/default/grub"
    if [[ ! -f "$grub_default" ]]; then
        log_warn "${grub_default} introuvable — skip GRUB"
        return 0
    fi

    # Helper : set ou ajoute "KEY=VALUE" dans /etc/default/grub.
    set_grub_var() {
        local key="$1" value="$2"
        if grep -qE "^${key}=" "$grub_default"; then
            sed -i "s|^${key}=.*|${key}=${value}|" "$grub_default"
        else
            printf '\n%s=%s\n' "$key" "$value" >> "$grub_default"
        fi
    }

    set_grub_var GRUB_TIMEOUT 0
    set_grub_var GRUB_TIMEOUT_STYLE hidden
    set_grub_var GRUB_RECORDFAIL_TIMEOUT 0

    # Reset le flag recordfail s'il était positionné par un boot précédent.
    if [[ -f /boot/grub/grubenv ]]; then
        grub-editenv /boot/grub/grubenv unset recordfail 2>/dev/null || true
    fi

    # Régénère la config grub effective.
    if command_exists update-grub; then
        update-grub >/dev/null 2>&1 || log_warn "update-grub a échoué — relance manuellement plus tard"
    elif command_exists grub-mkconfig; then
        grub-mkconfig -o /boot/grub/grub.cfg >/dev/null 2>&1 || log_warn "grub-mkconfig a échoué"
    fi

    log_ok "GRUB silencieux : boot direct, plus de menu, recordfail=0"
}

wipe_gnome_keyring() {
    # En auto-login GDM, le user ne saisit aucun mot de passe, donc pam_gnome_keyring
    # ne peut pas déchiffrer le trousseau existant → popup "le trousseau n'a pas été
    # déverrouillé". Solution simple pour un kiosk : supprimer le trousseau. Chrome est
    # lancé avec --password-store=basic (voir onair-display.desktop) donc il n'en a pas
    # besoin, et les autres apps GNOME créeront un nouveau trousseau vide à la demande.
    log_info "Suppression du trousseau GNOME existant de '${LINUX_USER}'"
    local keyring_dir="${LINUX_USER_HOME}/.local/share/keyrings"
    if [[ -d "$keyring_dir" ]]; then
        rm -f "${keyring_dir}"/login.keyring \
              "${keyring_dir}"/default \
              "${keyring_dir}"/user.keystore 2>/dev/null || true
        log_ok "Trousseau vidé (il sera recréé vide à la prochaine session)"
    else
        log_ok "Pas de trousseau existant (ok)"
    fi
}

apply_appliance_tweaks() {
    log_step "Durcissements appliance (timezone, veille, updates, snap, GNOME, GRUB, keyring)"
    set_timezone
    disable_sleep_and_suspend
    disable_auto_updates
    disable_snap_refresh
    configure_dconf_defaults_for_user
    configure_grub_silent_boot
    wipe_gnome_keyring
}
