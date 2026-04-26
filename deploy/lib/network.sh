#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — configuration IP statique via NetworkManager (nmcli)

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

setup_network() {
    log_step "Configuration de l'IP statique"

    if ! command_exists nmcli; then
        die "nmcli introuvable — NetworkManager est requis (présent sur Ubuntu Desktop par défaut)."
    fi

    # Liste des connexions actives
    local connections
    connections=$(nmcli -t -f NAME,DEVICE,STATE con show --active 2>/dev/null | grep ':activated$' || true)
    if [[ -z "$connections" ]]; then
        die "Aucune connexion réseau active détectée."
    fi

    log_info "Connexions actives :"
    echo "$connections" | awk -F: '{printf "  - %s (device %s)\n", $1, $2}'

    local default_name default_device
    default_name=$(echo "$connections" | head -n 1 | cut -d: -f1)
    default_device=$(echo "$connections" | head -n 1 | cut -d: -f2)

    local conn_name ip_cidr gateway dns
    conn_name=$(prompt_default "Connexion à configurer" "$default_name")

    # Pré-remplissage des valeurs depuis la config actuelle de la connexion
    # (manual OU DHCP : on récupère l'IP réellement active du device en fallback).
    local current_ip current_gw current_dns device
    device=$(nmcli -t -g GENERAL.DEVICES con show "$conn_name" 2>/dev/null | head -n 1)
    device="${device:-$default_device}"

    current_ip=$(nmcli -g ipv4.addresses con show "$conn_name" 2>/dev/null | head -n 1)
    if [[ -z "$current_ip" ]] && [[ -n "$device" ]]; then
        current_ip=$(ip -4 -o addr show dev "$device" 2>/dev/null | awk '{print $4}' | head -n 1)
    fi

    current_gw=$(nmcli -g ipv4.gateway con show "$conn_name" 2>/dev/null | head -n 1)
    if [[ -z "$current_gw" ]] && [[ -n "$device" ]]; then
        current_gw=$(ip -4 route show default dev "$device" 2>/dev/null | awk '{print $3}' | head -n 1)
    fi

    current_dns=$(nmcli -g ipv4.dns con show "$conn_name" 2>/dev/null | head -n 1 | tr ' ' ',')
    if [[ -z "$current_dns" ]] && [[ -n "$device" ]]; then
        # DNS via IP4.DNS du device (fallback DHCP) — valeurs séparées par " | "
        current_dns=$(nmcli -g IP4.DNS device show "$device" 2>/dev/null \
            | head -n 1 | tr -s ' |' ',' | sed 's/^,//; s/,$//')
    fi

    ip_cidr=$(prompt_default "IP/masque CIDR (ex: 192.168.1.50/24)" "$current_ip")
    if [[ -z "$ip_cidr" ]]; then
        die "IP/CIDR obligatoire."
    fi
    gateway=$(prompt_default "Passerelle" "$current_gw")
    if [[ -z "$gateway" ]]; then
        die "Passerelle obligatoire."
    fi
    dns=$(prompt_default "DNS (séparés par virgule)" "${current_dns:-1.1.1.1,8.8.8.8}")

    log_info "Application sur '$conn_name' : $ip_cidr via $gateway (DNS: $dns)"

    nmcli con mod "$conn_name" ipv4.addresses "$ip_cidr" \
        || die "Échec nmcli con mod ipv4.addresses"
    nmcli con mod "$conn_name" ipv4.gateway "$gateway" \
        || die "Échec nmcli con mod ipv4.gateway"
    nmcli con mod "$conn_name" ipv4.dns "$dns" \
        || die "Échec nmcli con mod ipv4.dns"
    nmcli con mod "$conn_name" ipv4.method manual \
        || die "Échec nmcli con mod ipv4.method"
    nmcli con up "$conn_name" \
        || die "Échec nmcli con up '$conn_name' — vérifie les paramètres et les logs NetworkManager"

    sleep 2
    log_ok "IP statique appliquée :"
    ip -4 addr show | grep 'inet ' | grep -v '127.0.0.1' | awk '{printf "  - %s sur %s\n", $2, $NF}'

    # Export pour le récap final
    STATIC_IP="${ip_cidr%/*}"
    export STATIC_IP
}
