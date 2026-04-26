#!/usr/bin/env bash
# OnAir Studio — entry point interactif.
# Détecte si l'app est installée. Si oui : menu update / désinstaller.
# Si non : menu install. Toutes les opérations passent par les scripts existants.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export REPO_ROOT

# shellcheck source=deploy/lib/common.sh
source "${REPO_ROOT}/deploy/lib/common.sh"

readonly APP_DIR="/opt/onair-studio"

# ── Détection d'état ──────────────────────────────────────────────────

is_installed() {
    [[ -d "${APP_DIR}/.git" ]]
}

state_service_status() {
    if systemctl is-active --quiet onair-server.service 2>/dev/null; then
        echo "actif"
    elif systemctl is-failed --quiet onair-server.service 2>/dev/null; then
        echo "en échec"
    elif systemctl list-unit-files onair-server.service >/dev/null 2>&1; then
        echo "arrêté"
    else
        echo "non installé"
    fi
}

state_listen_port() {
    local f="${APP_DIR}/server/src/custom-settings.json"
    if [[ -f "$f" ]] && command_exists jq; then
        jq -r '.listenPort // 3333' "$f" 2>/dev/null || echo "3333"
    else
        echo "3333"
    fi
}

state_app_version() {
    local f="${APP_DIR}/package.json"
    if [[ -f "$f" ]] && command_exists jq; then
        jq -r '.version // "?"' "$f" 2>/dev/null || echo "?"
    else
        echo "?"
    fi
}

state_git_commit() {
    if [[ -d "${APP_DIR}/.git" ]]; then
        git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo "?"
    else
        echo "—"
    fi
}

state_uptime() {
    if systemctl is-active --quiet onair-server.service 2>/dev/null; then
        local since since_ts now elapsed
        since=$(systemctl show onair-server.service --property=ActiveEnterTimestamp --value 2>/dev/null)
        if [[ -n "$since" && "$since" != "n/a" ]]; then
            since_ts=$(date -d "$since" +%s 2>/dev/null || echo 0)
            now=$(date +%s)
            elapsed=$((now - since_ts))
            local d h m
            d=$((elapsed / 86400))
            h=$(( (elapsed % 86400) / 3600 ))
            m=$(( (elapsed % 3600) / 60 ))
            if (( d > 0 )); then printf "%dj %dh" "$d" "$h"
            elif (( h > 0 )); then printf "%dh %dmin" "$h" "$m"
            else printf "%dmin" "$m"; fi
        else
            echo "—"
        fi
    else
        echo "—"
    fi
}

state_local_ip() {
    hostname -I 2>/dev/null | awk '{print $1}' || echo "—"
}

state_app_user() {
    if [[ -d "$APP_DIR" ]]; then
        stat -c '%U' "$APP_DIR" 2>/dev/null
    else
        echo "—"
    fi
}

# ── UI helpers ─────────────────────────────────────────────────────────
# Largeur fixe 70 — fonctionne sur n'importe quel terminal ≥ 80 colonnes.

readonly W=70

show_banner() {
    clear
    printf "\n"
    printf "${CLR_CYAN}   ╔══════════════════════════════════════════════════════════════════╗${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}                                                                  ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}     ${CLR_BOLD}${CLR_RED}██████╗ ███╗   ██╗     █████╗ ██╗██████╗${CLR_RESET}                     ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}     ${CLR_BOLD}${CLR_RED}██╔═══██╗████╗  ██║   ██╔══██╗██║██╔══██╗${CLR_RESET}                    ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}     ${CLR_BOLD}${CLR_RED}██║   ██║██╔██╗ ██║   ███████║██║██████╔╝${CLR_RESET}                    ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}     ${CLR_BOLD}${CLR_RED}██║   ██║██║╚██╗██║   ██╔══██║██║██╔══██╗${CLR_RESET}                    ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}     ${CLR_BOLD}${CLR_RED}╚██████╔╝██║ ╚████║   ██║  ██║██║██║  ██║${CLR_RESET}                    ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}      ${CLR_BOLD}${CLR_RED}╚═════╝ ╚═╝  ╚═══╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝${CLR_RESET}                    ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}                                                                  ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}                  ${CLR_BOLD}─── S T U D I O ───${CLR_RESET}                             ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}             ${CLR_CYAN}Broadcast Timer for Radio / TV${CLR_RESET}                       ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ║${CLR_RESET}                                                                  ${CLR_CYAN}║${CLR_RESET}\n"
    printf "${CLR_CYAN}   ╚══════════════════════════════════════════════════════════════════╝${CLR_RESET}\n"
    printf "\n"
}

# ui_box_top "Title" [color]
ui_box_top() {
    local title="$1" color="${2:-$CLR_CYAN}"
    local title_with_pad=" ${title} "
    local title_len=${#title_with_pad}
    local fill=$(( W - title_len - 4 ))   # 4 = ┌─ et ─┐
    printf "${color}┌─${title_with_pad}"
    printf '─%.0s' $(seq 1 "$fill")
    printf "─┐${CLR_RESET}\n"
}

ui_box_bottom() {
    local color="${1:-$CLR_CYAN}"
    printf "${color}└"
    printf '─%.0s' $(seq 1 "$W")
    printf "┘${CLR_RESET}\n"
}

# ui_box_line "key" "value" [color]
ui_box_line() {
    local key="$1" value="$2" color="${3:-$CLR_CYAN}"
    # 18 char column for key, reste pour value, total interne = W-2
    local content
    content=$(printf "  %-20s ${CLR_BOLD}%s${CLR_RESET}" "$key" "$value")
    # Strip ANSI for length calc
    local plain_len
    plain_len=$(printf "  %-20s %s" "$key" "$value" | wc -c)
    local pad=$(( W - plain_len ))
    (( pad < 0 )) && pad=0
    printf "${color}│${CLR_RESET}%s%*s${color}│${CLR_RESET}\n" "$content" "$pad" ''
}

ui_box_empty() {
    local color="${1:-$CLR_CYAN}"
    printf "${color}│${CLR_RESET}%*s${color}│${CLR_RESET}\n" "$W" ''
}

# ui_box_text "free text"
ui_box_text() {
    local text="$1" color="${2:-$CLR_CYAN}"
    local plain_len=${#text}
    local pad=$(( W - plain_len - 2 ))
    (( pad < 0 )) && pad=0
    printf "${color}│${CLR_RESET}  %s%*s${color}│${CLR_RESET}\n" "$text" "$pad" ''
}

# ── Affichage état ─────────────────────────────────────────────────────

show_status_panel() {
    local status port version commit uptime ip user url status_colored
    status=$(state_service_status)
    port=$(state_listen_port)
    version=$(state_app_version)
    commit=$(state_git_commit)
    uptime=$(state_uptime)
    ip=$(state_local_ip)
    user=$(state_app_user)
    url="http://${ip}:${port}"

    # Color le statut sans casser la largeur du printf
    case "$status" in
        actif)        status_colored="${CLR_GREEN}● actif${CLR_RESET}" ;;
        arrêté)       status_colored="${CLR_YELLOW}○ arrêté${CLR_RESET}" ;;
        "en échec")   status_colored="${CLR_RED}✕ en échec${CLR_RESET}" ;;
        *)            status_colored="${CLR_RED}— $status${CLR_RESET}" ;;
    esac

    ui_box_top "Installation détectée" "$CLR_GREEN"
    ui_box_empty "$CLR_GREEN"
    # Pour le statut on doit gérer le coloriage manuellement
    local plain
    plain=$(printf "  %-20s %s" "Service" "$status")
    local pad=$(( W - ${#plain} ))
    (( pad < 0 )) && pad=0
    printf "${CLR_GREEN}│${CLR_RESET}  %-20s %b%*s${CLR_GREEN}│${CLR_RESET}\n" "Service" "$status_colored" "$pad" ''

    ui_box_line "Adresse" "$url" "$CLR_GREEN"
    ui_box_line "Version" "$version (commit $commit)" "$CLR_GREEN"
    ui_box_line "Uptime" "$uptime" "$CLR_GREEN"
    ui_box_line "Utilisateur Linux" "$user" "$CLR_GREEN"
    ui_box_line "Dossier d'install" "$APP_DIR" "$CLR_GREEN"
    ui_box_empty "$CLR_GREEN"
    ui_box_bottom "$CLR_GREEN"
}

show_fresh_panel() {
    local current_user="${SUDO_USER:-$USER}"
    local local_ip
    local_ip=$(state_local_ip)

    ui_box_top "Aucune installation détectée" "$CLR_YELLOW"
    ui_box_empty "$CLR_YELLOW"
    ui_box_text "OnAir Studio n'est pas encore installé sur cette machine." "$CLR_YELLOW"
    ui_box_empty "$CLR_YELLOW"
    ui_box_line "Utilisateur cible" "$current_user (sudo courant)" "$CLR_YELLOW"
    ui_box_line "IP locale détectée" "$local_ip" "$CLR_YELLOW"
    ui_box_empty "$CLR_YELLOW"
    ui_box_bottom "$CLR_YELLOW"
}

# ── Menus ──────────────────────────────────────────────────────────────

show_installed_menu() {
    printf "\n${CLR_BOLD}  Que veux-tu faire ?${CLR_RESET}\n\n"
    printf "    ${CLR_GREEN}[1]${CLR_RESET}  Mettre à jour OnAir Studio       ${CLR_CYAN}— git pull + rebuild + restart${CLR_RESET}\n"
    printf "    ${CLR_RED}[2]${CLR_RESET}  Désinstaller complètement        ${CLR_CYAN}— préserve user et config IP${CLR_RESET}\n"
    printf "    ${CLR_BLUE}[Q]${CLR_RESET}  Quitter\n\n"
}

show_fresh_menu() {
    printf "\n${CLR_BOLD}  Que veux-tu faire ?${CLR_RESET}\n\n"
    printf "    ${CLR_GREEN}[1]${CLR_RESET}  Installer OnAir Studio\n"
    printf "    ${CLR_BLUE}[Q]${CLR_RESET}  Quitter\n\n"
}

ask_choice() {
    local prompt="${1:-Choix}" choice
    read -r -p "$(printf "  ${CLR_BOLD}? %s${CLR_RESET} : " "$prompt")" choice
    echo "$choice"
}

# ── Actions ────────────────────────────────────────────────────────────

action_install() {
    log_step "Lancement de l'installation"
    sleep 1
    bash "${REPO_ROOT}/install.sh"
}

action_update() {
    log_step "Lancement de la mise à jour"
    sleep 1
    if [[ -x "${APP_DIR}/update.sh" ]]; then
        bash "${APP_DIR}/update.sh"
    else
        log_error "${APP_DIR}/update.sh introuvable ou non exécutable."
        exit 1
    fi
}

action_uninstall() {
    printf "\n"
    log_warn "ATTENTION : cette opération supprime :"
    printf "    • ${APP_DIR} (templates, uploads, branding, mot de passe admin)\n"
    printf "    • Services systemd (onair-server, onair-update)\n"
    printf "    • Règle udev (relais USB)\n"
    printf "    • Sudoers auto-update\n"
    printf "    • Autostart kiosk + dconf de l'utilisateur\n"
    printf "\n"
    log_info "Préservés : utilisateur Linux, config réseau (IP statique), paquets apt"
    printf "\n"

    if ! confirm "Confirmer la désinstallation ?"; then
        log_info "Désinstallation annulée."
        return 0
    fi

    # Détecte l'utilisateur cible avant suppression du dossier (pour cleanup dconf)
    local kiosk_user kiosk_home
    kiosk_user=$(stat -c '%U' "$APP_DIR" 2>/dev/null || echo "")
    if [[ -n "$kiosk_user" ]]; then
        kiosk_home=$(getent passwd "$kiosk_user" | cut -d: -f6)
        export LINUX_USER="$kiosk_user" LINUX_USER_HOME="$kiosk_home"
    fi

    # shellcheck source=deploy/lib/uninstall.sh
    source "${REPO_ROOT}/deploy/lib/uninstall.sh"
    uninstall_app "$APP_DIR"

    printf "\n"
    log_ok "Tu peux maintenant relancer ${CLR_BOLD}sudo ./launch.sh${CLR_RESET} pour réinstaller."
}

# ── Main ───────────────────────────────────────────────────────────────

main() {
    if [[ $EUID -ne 0 ]]; then
        printf "${CLR_RED}✗ Ce script doit être exécuté en root :${CLR_RESET}\n"
        printf "    sudo $0\n"
        exit 1
    fi

    if [[ -z "${SUDO_USER:-}" || "$SUDO_USER" == "root" ]]; then
        printf "${CLR_RED}✗ Lance via sudo depuis ta session utilisateur :${CLR_RESET}\n"
        printf "    sudo ./launch.sh   (pas en root direct)\n"
        exit 1
    fi

    show_banner

    local choice
    if is_installed; then
        show_status_panel
        show_installed_menu
        choice=$(ask_choice)
        case "$choice" in
            1)   action_update ;;
            2)   action_uninstall ;;
            Q|q) printf "\n${CLR_CYAN}À bientôt.${CLR_RESET}\n" ; exit 0 ;;
            *)   log_error "Choix invalide : '$choice'" ; exit 1 ;;
        esac
    else
        show_fresh_panel
        show_fresh_menu
        choice=$(ask_choice)
        case "$choice" in
            1)   action_install ;;
            Q|q) printf "\n${CLR_CYAN}À bientôt.${CLR_RESET}\n" ; exit 0 ;;
            *)   log_error "Choix invalide : '$choice'" ; exit 1 ;;
        esac
    fi
}

main "$@"
