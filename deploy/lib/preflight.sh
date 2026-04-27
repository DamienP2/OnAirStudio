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

    # Connectivité Internet — on teste plusieurs cibles en parallèle ; il
    # suffit qu'une réponde pour valider que l'install peut continuer. Évite
    # le faux-positif quand un domaine spécifique est temporairement indispo.
    local probes=(
        "https://github.com"
        "https://deb.nodesource.com"
        "https://dl.google.com"
        "https://1.1.1.1"
    )
    local connected=0
    local probe_ok=""
    for url in "${probes[@]}"; do
        if curl -fsSI --max-time 4 "$url" >/dev/null 2>&1; then
            connected=1
            probe_ok="$url"
            break
        fi
    done
    if [[ "$connected" -eq 0 ]]; then
        die "Pas de connexion Internet — aucune des cibles de test n'a répondu (${probes[*]}).
   Vérifie : interface réseau active, DNS, pare-feu, proxy.
   Pour diagnostiquer : curl -v https://github.com"
    fi
    log_ok "Connexion Internet OK (via ${probe_ok})"

    # Espace disque sur /opt
    local free_mb
    free_mb=$(df -BM --output=avail /opt 2>/dev/null | tail -n 1 | tr -dc '0-9')
    if [[ -z "$free_mb" ]] || [[ "$free_mb" -lt 2048 ]]; then
        die "Espace disque insuffisant sur /opt : ${free_mb:-0} Mo libres (2 Go requis)."
    fi
    log_ok "Espace disque /opt : ${free_mb} Mo"
}
