#!/bin/bash
# Monitorar todos os public_html do HestiaCP
# Corrigir dono automaticamente caso root crie algo.
# Logs enviados para systemd journal

log() {
    logger -t fix-hestia-watch "$1"
}

fix_owner() {
    FILE="$1"
    USER=$(echo "$FILE" | cut -d'/' -f3)

    if [ -n "$USER" ]; then
        log "[FIX] Corrigindo $FILE para $USER:$USER"
        chown -R "$USER:$USER" "$FILE"
    fi
}

echo "=== Iniciando monitor de permissões HestiaCP ==="
log "Serviço iniciado e monitorando /home"

inotifywait -m -r -e create,move /home --format '%w%f' |
while read NEWFILE; do
    # Se for um diretório public_html recém criado → aplica ACL + setgid
    if [[ "$NEWFILE" == */public_html ]]; then
        USER=$(echo "$NEWFILE" | cut -d'/' -f3)
        log "[NEW SITE] Detectado $NEWFILE para usuário $USER"
        setfacl -R -m u:$USER:rwx "$NEWFILE"
        setfacl -R -d -m u:$USER:rwx "$NEWFILE"
        chmod g+s "$NEWFILE"
    fi

    # Corrige dono de arquivos/pastas criados
    fix_owner "$NEWFILE"
done
