#!/usr/bin/env bash
# shellcheck shell=bash
# OnAir Studio — clone + build de l'app dans /opt/onair-studio

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

readonly APP_DIR="/opt/onair-studio"

# REPO_URL et ADMIN_PASSWORD sont passés en variables d'environnement depuis install.sh
install_app() {
    log_step "Clone et build d'OnAir Studio dans ${APP_DIR}"

    if [[ -z "${REPO_URL:-}" ]]; then
        die "REPO_URL non défini (à configurer dans install.sh)."
    fi
    if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
        die "ADMIN_PASSWORD non défini."
    fi

    # Si un clone existant appartient à un autre user (install précédente avec
    # un user différent), on réaligne l'ownership récursivement AVANT toute
    # opération git pour éviter "fatal: detected dubious ownership".
    # Il faut vérifier .git (pas le dossier top-level) car `install -d -o`
    # plus bas ne fait pas de récursion.
    if [[ -d "${APP_DIR}/.git" ]]; then
        local current_owner
        current_owner=$(stat -c '%U' "${APP_DIR}/.git" 2>/dev/null || echo "unknown")
        if [[ "$current_owner" != "$LINUX_USER" ]]; then
            log_warn "Ownership ${APP_DIR} actuel: '${current_owner}' — réalignement récursif sur '${LINUX_USER}'"
            chown -R "${LINUX_USER}:${LINUX_USER}" "$APP_DIR"
        fi
    fi

    install -d -m 755 -o "$LINUX_USER" -g "$LINUX_USER" "$APP_DIR"

    if [[ -d "${APP_DIR}/.git" ]]; then
        log_info "Clone existant — mise à jour"
        # Réaligne l'URL remote (cas migration ancien SSH alias → HTTPS public)
        sudo -u "$LINUX_USER" git -C "$APP_DIR" remote set-url origin "$REPO_URL"
        # fetch + reset --hard plutôt que pull --ff-only : tolérant aux
        # divergences d'historique (force-push amont, orphan branch, rebase
        # côté maintainer). Les données utilisateur (templates/, uploads/,
        # branding/, custom-settings.json, admin-password.json) sont
        # gitignored et ne sont pas affectées par le reset.
        sudo -u "$LINUX_USER" git -C "$APP_DIR" fetch origin
        sudo -u "$LINUX_USER" git -C "$APP_DIR" reset --hard origin/main
    else
        log_info "Clone initial (${REPO_URL})"
        sudo -u "$LINUX_USER" git clone "$REPO_URL" "$APP_DIR"
    fi

    log_info "Build du client (npm ci + npm run build)"
    (cd "${APP_DIR}/client" && sudo -u "$LINUX_USER" npm ci && sudo -u "$LINUX_USER" npm run build)

    log_info "Install des deps serveur (npm ci)"
    (cd "${APP_DIR}/server" && sudo -u "$LINUX_USER" npm ci)

    log_info "Écriture du mot de passe admin dans admin-password.json"
    local pw_file="${APP_DIR}/server/src/admin-password.json"
    printf '{\n  "password": %s\n}\n' "$(jq -Rn --arg pw "$ADMIN_PASSWORD" '$pw')" > "$pw_file"
    chown "$LINUX_USER:$LINUX_USER" "$pw_file"
    chmod 600 "$pw_file"

    # Identité studio + serveur NTP → custom-settings.json
    # On ne l'écrit que s'il n'existe pas déjà (préserve les modifs faites depuis l'UI).
    local cs_file="${APP_DIR}/server/src/custom-settings.json"
    if [[ ! -f "$cs_file" ]]; then
        local studio_name="${STUDIO_NAME:-OnAir Studio}"
        local ntp_server="${NTP_SERVER:-pool.ntp.org}"
        local timezone="${TIMEZONE:-Europe/Paris}"
        local language="${LANGUAGE:-fr}"
        log_info "Écriture de custom-settings.json (studio: ${studio_name}, ntp: ${ntp_server}, tz: ${timezone}, lang: ${language})"
        jq -n \
            --arg studio "$studio_name" \
            --arg ntp "$ntp_server" \
            --arg tz "$timezone" \
            --arg lang "$language" \
            '{
                studioName: $studio,
                ntpServer: $ntp,
                timezone: $tz,
                language: $lang,
                defaultDisplayMode: "two",
                colors: {
                    current: "#FFFFFF",
                    elapsed: "#3B82F6",
                    remaining: "#EF4444"
                },
                presetTimes: [
                    { label: "12 min", value: "00:12:00" },
                    { label: "26 min", value: "00:26:00" },
                    { label: "52 min", value: "00:52:00" },
                    { label: "90 min", value: "01:30:00" }
                ]
            }' > "$cs_file"
        chown "$LINUX_USER:$LINUX_USER" "$cs_file"
        chmod 644 "$cs_file"
    else
        log_info "custom-settings.json existe déjà — préservé"
    fi

    log_ok "App installée dans ${APP_DIR}"
}
