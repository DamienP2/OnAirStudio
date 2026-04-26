#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — helpers communs pour les scripts d'install et update
# À sourcer : source deploy/lib/common.sh

# Idempotence : si déjà sourcé dans le même process, on ne redéclare pas les
# variables readonly (sinon bash plante avec "variable en lecture seule").
if [[ -n "${_ONAIR_COMMON_SOURCED:-}" ]]; then
    return 0
fi
readonly _ONAIR_COMMON_SOURCED=1

# Couleurs (désactivées si stdout n'est pas un TTY)
if [[ -t 1 ]]; then
    readonly CLR_RESET=$'\033[0m'
    readonly CLR_RED=$'\033[31m'
    readonly CLR_GREEN=$'\033[32m'
    readonly CLR_YELLOW=$'\033[33m'
    readonly CLR_BLUE=$'\033[34m'
    readonly CLR_CYAN=$'\033[36m'
    readonly CLR_BOLD=$'\033[1m'
else
    readonly CLR_RESET=""
    readonly CLR_RED=""
    readonly CLR_GREEN=""
    readonly CLR_YELLOW=""
    readonly CLR_BLUE=""
    readonly CLR_CYAN=""
    readonly CLR_BOLD=""
fi

log_step()  { printf "\n${CLR_BOLD}${CLR_BLUE}▶ %s${CLR_RESET}\n" "$*"; }
log_info()  { printf "${CLR_CYAN}ℹ %s${CLR_RESET}\n" "$*"; }
log_ok()    { printf "${CLR_GREEN}✓ %s${CLR_RESET}\n" "$*"; }
log_warn()  { printf "${CLR_YELLOW}⚠ %s${CLR_RESET}\n" "$*" >&2; }
log_error() { printf "${CLR_RED}✗ %s${CLR_RESET}\n" "$*" >&2; }

die() {
    log_error "$*"
    exit 1
}

ensure_root() {
    if [[ $EUID -ne 0 ]]; then
        die "Ce script doit être exécuté en root : sudo $0"
    fi
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# prompt_default <message> <default_value> → lit stdin, retourne la valeur (défaut si vide)
prompt_default() {
    local msg="$1" default="$2" answer
    read -r -p "$(printf "${CLR_BOLD}?${CLR_RESET} %s [${CLR_CYAN}%s${CLR_RESET}] : " "$msg" "$default")" answer
    echo "${answer:-$default}"
}

# prompt_password <message> → double saisie masquée, min 4 chars, retourne la valeur
prompt_password() {
    local msg="$1" pw1 pw2
    # shellcheck disable=SC2059
    printf "${CLR_CYAN}ℹ Conseil : utilise des caractères ASCII uniquement (pas d'accents) pour éviter les soucis de saisie.${CLR_RESET}\n" >&2
    while true; do
        read -r -s -p "$(printf "${CLR_BOLD}?${CLR_RESET} %s : " "$msg")" pw1
        echo >&2
        printf "  ${CLR_CYAN}(%d caractères saisis)${CLR_RESET}\n" "${#pw1}" >&2
        if [[ ${#pw1} -lt 4 ]]; then
            log_warn "Mot de passe trop court (min 4 caractères), réessaie."
            continue
        fi
        read -r -s -p "$(printf '%s' "${CLR_BOLD}?${CLR_RESET} Confirme : ")" pw2
        echo >&2
        printf "  ${CLR_CYAN}(%d caractères saisis)${CLR_RESET}\n" "${#pw2}" >&2
        if [[ "$pw1" != "$pw2" ]]; then
            log_warn "Les mots de passe ne correspondent pas (vérifie les accents éventuels)."
            continue
        fi
        break
    done
    echo "$pw1"
}

# confirm <message> → retourne 0 si oui, 1 si non (défaut = non)
confirm() {
    local msg="$1" answer
    read -r -p "$(printf "${CLR_BOLD}?${CLR_RESET} %s [y/N] : " "$msg")" answer
    [[ "$answer" =~ ^[yYoO] ]]
}

# Récupère le chemin absolu du repo (là où install.sh / update.sh tourne)
repo_root() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
    # common.sh est dans deploy/lib/ — on remonte de 2 niveaux si sourcé depuis un lib
    if [[ "$script_dir" == */deploy/lib ]]; then
        echo "${script_dir%/deploy/lib}"
    else
        echo "$script_dir"
    fi
}
