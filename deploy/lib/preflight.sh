#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — vérifications préalables à l'installation

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

run_preflight() {
    log_step "Vérifications préalables"

    ensure_root

    # OS = Ubuntu
    if [[ ! -r /etc/os-release ]]; then
        die "Impossible de lire /etc/os-release — ce script nécessite Ubuntu."
    fi
    # shellcheck disable=SC1091
    source /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        die "OS détecté : $ID. Ce script ne supporte que Ubuntu."
    fi
    log_ok "OS : Ubuntu $VERSION_ID"

    # Version recommandée : 22.04 ou 24.04
    case "$VERSION_ID" in
        22.04|24.04)
            log_ok "Version LTS supportée"
            ;;
        *)
            log_warn "Version Ubuntu $VERSION_ID non testée (supportées : 22.04, 24.04). Continuer à tes risques."
            confirm "Continuer quand même ?" || die "Abandon."
            ;;
    esac

    # Architecture
    local arch
    arch="$(uname -m)"
    case "$arch" in
        x86_64|aarch64)
            log_ok "Architecture : $arch"
            ;;
        *)
            die "Architecture non supportée : $arch (x86_64 ou aarch64 requis)"
            ;;
    esac

    # Environnement graphique présent
    if [[ -z "${XDG_CURRENT_DESKTOP:-}" ]] \
        && ! command_exists gnome-session \
        && ! command_exists gdm3; then
        die "Aucun environnement graphique détecté. Ce script requiert Ubuntu *Desktop* (pas Server)."
    fi
    log_ok "Environnement graphique détecté"

    # Connectivité Internet — test pur bash via /dev/tcp (pas de dépendance
    # à curl/wget qui peuvent ne pas être installés sur un Ubuntu fresh).
    # On teste plusieurs cibles TCP/443, il suffit qu'une réponde.
    local probes=(
        "github.com:443"
        "deb.nodesource.com:443"
        "dl.google.com:443"
        "1.1.1.1:443"
    )
    local connected=0
    local probe_ok=""
    for probe in "${probes[@]}"; do
        local host="${probe%:*}"
        local port="${probe#*:}"
        # timeout 4s, redirige stderr pour silencer "Connection timed out"
        if timeout 4 bash -c "exec 3<>/dev/tcp/${host}/${port}" 2>/dev/null; then
            connected=1
            probe_ok="$probe"
            break
        fi
    done
    if [[ "$connected" -eq 0 ]]; then
        die "Pas de connexion Internet — aucune des cibles TCP/443 ne répond (${probes[*]}).
   Vérifie : interface réseau active, DNS, pare-feu, proxy.
   Diagnostic : nslookup github.com puis bash -c 'echo > /dev/tcp/github.com/443'"
    fi
    log_ok "Connexion Internet OK (via ${probe_ok})"

    # Installe curl + ca-certificates si absents — nécessaires aux étapes
    # suivantes (téléchargement keyrings NodeSource, Chrome, etc.).
    # Ubuntu Desktop 26.04 n'inclut plus curl par défaut.
    if ! command_exists curl; then
        log_info "Installation de curl + ca-certificates (manquants)..."
        if ! apt-get update -qq >/dev/null 2>&1; then
            log_warn "apt-get update a échoué — vérifie /etc/apt/sources.list"
        fi
        if ! apt-get install -y -qq curl ca-certificates >/dev/null 2>&1; then
            die "Impossible d'installer curl. Lance manuellement : sudo apt install -y curl ca-certificates"
        fi
        log_ok "curl installé"
    fi

    # Espace disque sur /opt
    local free_mb
    free_mb=$(df -BM --output=avail /opt 2>/dev/null | tail -n 1 | tr -dc '0-9')
    if [[ -z "$free_mb" ]] || [[ "$free_mb" -lt 2048 ]]; then
        die "Espace disque insuffisant sur /opt : ${free_mb:-0} Mo libres (2 Go requis)."
    fi
    log_ok "Espace disque /opt : ${free_mb} Mo"
}
