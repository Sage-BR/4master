#!/bin/bash
# ============================================
# HestiaCP Permission Watcher v4.1 CORRIGIDO
# Mantém permissões: WEB + MAIL + DNS
# Detecta novos clientes automaticamente
# FIX: Monitora recursivamente com otimizações
# ============================================

set -u

readonly SCRIPT_NAME="fix-hestia-watch"
readonly LOCK_DIR="/var/run/${SCRIPT_NAME}"
readonly DEBOUNCE_TIME=5  # Reduzido para resposta mais rápida
readonly MAX_DEPTH=4
readonly LOG_FILE="/var/log/${SCRIPT_NAME}.log"
readonly MAX_JOBS=4
readonly MAX_BG_PROCS=8

# Cache para evitar processamento duplicado
declare -A LAST_PROCESS_TIME

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    logger -t "$SCRIPT_NAME" -p user.info "$msg" 2>/dev/null || true
    echo "$msg" | tee -a "$LOG_FILE" >&2
}

log_error() {
    local msg="[ERROR] $1"
    logger -t "$SCRIPT_NAME" -p user.err "$msg" 2>/dev/null || true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $msg" | tee -a "$LOG_FILE" >&2
}

cleanup() {
    log "Encerrando ${SCRIPT_NAME}..."
    if [[ -d "$LOCK_DIR" ]]; then
        find "$LOCK_DIR" -maxdepth 1 -type f -name "*.lock" 2>/dev/null | \
            while read lf; do
                [[ -f "$lf" && $(cat "$lf" 2>/dev/null) == "$$" ]] && rm -f "$lf" 2>/dev/null
            done
    fi
    jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ============================================
# FUNÇÕES DE BIND/DNS
# ============================================

fix_bind_permissions() {
    log "[BIND] Corrigindo permissões DNS"
    
    for dns_dir in /home/*/conf/dns; do
        [[ -d "$dns_dir" ]] || continue
        
        local user=$(echo "$dns_dir" | cut -d'/' -f3)
        
        chown -R "$user:bind" "$dns_dir" 2>/dev/null
        chmod 750 "$dns_dir" 2>/dev/null
        find "$dns_dir" -type f -name "*.db" -exec chmod 644 {} + 2>/dev/null
        
        log "[BIND] OK: $dns_dir"
    done
}

fix_home_access() {
    for home_dir in /home/*; do
        [[ -d "$home_dir" ]] || continue
        
        chmod 711 "$home_dir" 2>/dev/null
        [[ -d "$home_dir/conf" ]] && chmod 711 "$home_dir/conf" 2>/dev/null
    done
}

# ============================================
# FUNÇÕES DE SESSÕES PHP
# ============================================

fix_php_sessions() {
    local sessions_dir="/var/lib/php/sessions"
    
    if [[ ! -d "$sessions_dir" ]]; then
        log "[PHP] Criando diretório de sessões"
        mkdir -p "$sessions_dir"
    fi
    
    # Permissão 1777 = todos podem escrever mas só dono pode deletar
    chmod 1777 "$sessions_dir" 2>/dev/null
    
    # Limpar sessões antigas (mais de 24h)
    find "$sessions_dir" -type f -name "sess_*" -mtime +1 -delete 2>/dev/null
    
    log "[PHP] Sessões OK: $sessions_dir ($(ls $sessions_dir/sess_* 2>/dev/null | wc -l) ativas)"
}

# ============================================
# FUNÇÕES DE MAIL
# ============================================

fix_mail_permissions() {
    local file="$1"
    
    if [[ "$file" =~ /home/[^/]+/conf/mail/[^/]+/ ]]; then
        local domain_dir=$(echo "$file" | grep -oP '/home/[^/]+/conf/mail/[^/]+' | head -1)
        
        if [[ -d "$domain_dir" ]]; then
            log "[MAIL] Corrigindo $domain_dir"
            
            chmod 750 "$domain_dir" 2>/dev/null
            chgrp mail "$domain_dir" 2>/dev/null
            
            for f in limits ip accounts aliases passwd dkim.pem fwd_only antispam; do
                [[ -f "$domain_dir/$f" ]] && chmod 640 "$domain_dir/$f" && chgrp mail "$domain_dir/$f" 2>/dev/null
            done
            
            if [[ -f "$domain_dir/passwd" ]]; then
                chown dovecot:mail "$domain_dir/passwd" 2>/dev/null
                chmod 640 "$domain_dir/passwd" 2>/dev/null
            fi
        fi
    fi
}

# ============================================
# FUNÇÕES DE WEB
# ============================================

get_user_from_path() {
    local path="$1"
    if [[ "$path" =~ ^/home/([^/]+)/ ]]; then
        local user="${BASH_REMATCH[1]}"
        if id "$user" &>/dev/null; then
            local uid=$(id -u "$user" 2>/dev/null) || return 1
            [[ $uid -ge 1000 ]] && echo "$user" && return 0
        fi
    fi
    return 1
}

acquire_lock() {
    local dir="$1"
    local hash=$(printf "%s" "$dir" | md5sum | cut -d' ' -f1)
    mkdir -p "$LOCK_DIR" 2>/dev/null || return 1
    local lock_file="${LOCK_DIR}/${hash}.lock"

    if [[ -f "$lock_file" ]]; then
        local pid=$(cat "$lock_file" 2>/dev/null)
        [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null && rm -f "$lock_file" 2>/dev/null
        [[ -f "$lock_file" ]] && return 1
    fi

    printf "%s" "$$" > "$lock_file" 2>/dev/null || return 1
    return 0
}

release_lock() {
    local dir="$1"
    local hash=$(printf "%s" "$dir" | md5sum | cut -d' ' -f1)
    local lock_file="${LOCK_DIR}/${hash}.lock"
    [[ -f "$lock_file" && $(cat "$lock_file" 2>/dev/null) == "$$" ]] && rm -f "$lock_file" 2>/dev/null
}

# ============================================
# CORREÇÃO OTIMIZADA DE ARQUIVO ÚNICO
# ============================================

fix_single_file() {
    local file="$1"
    local user="$2"
    
    [[ ! -e "$file" ]] && return 1
    
    # Corrigir owner+permissões em uma operação
    if [[ -f "$file" ]]; then
        chown "$user:$user" "$file" 2>/dev/null && chmod 0644 "$file" 2>/dev/null
        log "[WEB] Arquivo corrigido: $file"
    elif [[ -d "$file" ]]; then
        chown "$user:$user" "$file" 2>/dev/null && chmod 2755 "$file" 2>/dev/null
        log "[WEB] Diretório corrigido: $file"
    fi
}

# ============================================
# CORREÇÃO DE DIRETÓRIO PÚBLICO
# ============================================

fix_public_html_permissions() {
    local dir="$1"
    local user="$2"

    [[ -z "$user" || ! -d "$dir" || "$dir" != /home/* ]] && return 1
    
    acquire_lock "$dir" || return 1

    log "[WEB] Corrigindo $dir (user: $user)"
    
    chown -R "$user:$user" "$dir" 2>/dev/null
    find "$dir" -maxdepth $MAX_DEPTH \( \
        -type f -exec chmod 0644 {} + -o \
        -type d -exec chmod 2755 {} + \
    \) 2>/dev/null

    release_lock "$dir"
    return 0
}

# ============================================
# THROTTLING INTELIGENTE
# ============================================

should_process_now() {
    local key="$1"
    local now=$(date +%s)
    
    local last_time="${LAST_PROCESS_TIME[$key]:-0}"
    local elapsed=$((now - last_time))
    
    [[ $elapsed -lt $DEBOUNCE_TIME ]] && return 1
    
    LAST_PROCESS_TIME[$key]=$now
    return 0
}

# ============================================
# PROCESSAMENTO DE EVENTOS
# ============================================

process_event() {
    local file="$1"

    # Filtros rápidos
    case "$file" in
        *.tmp|*.swp|*.bak|*~|*.log|*.pid|*.lock|*.session|*.cache) return 0 ;;
        */tmp/*|*/cache/*|*/logs/*|*/sessions/*|*/.git/*|*/node_modules/*) return 0 ;;
    esac

    # === BIND/DNS ===
    if [[ "$file" =~ /conf/dns/ ]]; then
        should_process_now "bind" || return 0
        fix_bind_permissions
        systemctl reload bind9 2>/dev/null && log "[BIND] Recarregado" || log_error "[BIND] Falha ao recarregar"
        return 0
    fi

    # === MAIL ===
    if [[ "$file" =~ /conf/mail/ ]]; then
        should_process_now "mail:$file" || return 0
        fix_mail_permissions "$file"
        return 0
    fi

    # === WEB - NOVO SITE (diretório public_html criado) ===
    if [[ "$file" == */public_html ]] && [[ -d "$file" ]]; then
        should_process_now "dir:$file" || return 0
        local user
        if user=$(get_user_from_path "$file"); then
            log "[NEW SITE] Detectado: $file (user: $user)"
            fix_public_html_permissions "$file" "$user"
        fi
        return 0
    fi

    # === WEB - ARQUIVO/DIR DENTRO DE public_html ===
    if [[ "$file" == */public_html/* ]]; then
        # Encontrar o public_html pai
        local parent="${file%/*}"
        local levels=0
        
        while [[ "$parent" != "/" && $levels -lt 10 ]]; do
            if [[ "$parent" == */public_html ]]; then
                local user
                if user=$(get_user_from_path "$parent"); then
                    # Throttling por arquivo individual
                    should_process_now "file:$file" || return 0
                    
                    # Corrigir apenas o arquivo específico (mais rápido)
                    fix_single_file "$file" "$user"
                fi
                return 0
            fi
            parent="${parent%/*}"
            ((levels++))
        done
    fi
}

# ============================================
# INICIALIZAÇÃO
# ============================================

preflight_checks() {
    [[ $EUID -ne 0 ]] && { log_error "Requer root"; exit 1; }

    for cmd in inotifywait chown chmod find; do
        command -v "$cmd" &>/dev/null || { log_error "Falta: $cmd"; exit 1; }
    done

    [[ -d /home ]] || { log_error "/home não encontrado"; exit 1; }
    
    touch "$LOG_FILE" 2>/dev/null
    chmod 644 "$LOG_FILE" 2>/dev/null
}

initial_setup() {
    log "=== Setup Inicial ==="
    
    # Configurar grupos
    usermod -aG mail dovecot 2>/dev/null && log "Dovecot → grupo mail"
    
    # Corrigir acessos home
    fix_home_access
    log "Acessos /home configurados"
    
    # DNS inicial
    fix_bind_permissions
    systemctl reload bind9 2>/dev/null && log "[BIND] Serviço OK" || log_error "[BIND] Falha"
    
    # Web inicial (paralelo)
    log "Corrigindo sites existentes..."
    local count=0
    
    while IFS= read -r -d $'\0' public_dir; do
        local user
        user=$(get_user_from_path "$public_dir") || continue
        
        fix_public_html_permissions "$public_dir" "$user" &
        ((count++))
        
        [[ $count -ge $MAX_JOBS ]] && wait && count=0
    done < <(find /home -maxdepth 4 -type d -name "public_html" -print0 2>/dev/null)
    
    wait
    log "Setup inicial concluído"
}

# ============================================
# MAIN
# ============================================

main() {
    preflight_checks
    log "=== Iniciando ${SCRIPT_NAME} v4.1 (WEB+MAIL+DNS) [RECURSIVE FIX] ==="
    
    initial_setup
    
    log "=== Monitoramento em tempo real ==="
    
    # Coleta diretórios a monitorar
    local -a watch_dirs=()
    
    # Adiciona /home/*/conf para DNS e Mail (SEM recursão)
    while IFS= read -r -d $'\0' conf_dir; do
        watch_dirs+=("$conf_dir")
    done < <(find /home -maxdepth 2 -type d -name "conf" -print0 2>/dev/null)
    
    # Adiciona public_html para Web (COM recursão)
    while IFS= read -r -d $'\0' web_dir; do
        watch_dirs+=("$web_dir")
    done < <(find /home -maxdepth 4 -type d -name "public_html" -print0 2>/dev/null)
    
    [[ ${#watch_dirs[@]} -eq 0 ]] && { log_error "Nenhum diretório para monitorar"; exit 1; }
    
    log "Monitorando ${#watch_dirs[@]} diretórios RECURSIVAMENTE (throttling: ${DEBOUNCE_TIME}s)"

    # inotify COM recursão (-r) mas com exclusões otimizadas
    inotifywait -m -r \
        -e create -e moved_to -e close_write \
        --exclude '/(tmp|cache|logs|sessions|\.trash|\.git|node_modules|\.well-known|\.htpasswd|error_log|access_log)/' \
        --format '%w%f' \
        "${watch_dirs[@]}" 2>/dev/null |
    while IFS= read -r file; do
        local bg_count=$(jobs -r 2>/dev/null | wc -l)
        
        if [[ $bg_count -lt $MAX_BG_PROCS ]]; then
            process_event "$file" &
        else
            wait -n 2>/dev/null || true
            process_event "$file" &
        fi
    done
}

main "$@"
