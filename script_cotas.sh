#!/bin/bash

echo "=== Configuração Automática de Cotas HestiaCP ==="

# 1. Instalar ferramentas de quota
echo "1. Instalando ferramentas de quota..."
apt update
apt install -y quota quotatool

# 2. Parar serviços que podem interferir
echo "2. Parando serviços temporariamente..."
systemctl stop hestia
systemctl stop apache2 2>/dev/null || systemctl stop nginx 2>/dev/null

# 3. Remontar sistema de arquivos com cotas
echo "3. Remontando sistema de arquivos..."
mount -o remount /

# 4. Criar e inicializar arquivos de quota
echo "4. Inicializando arquivos de quota..."
quotacheck -cugm /
quotacheck -avugm

# 5. Definir permissões corretas
echo "5. Configurando permissões..."
chmod 600 /aquota.user /aquota.group

# 6. Ativar cotas
echo "6. Ativando cotas..."
quotaon -a

# 7. Verificar se cotas estão ativas
echo "7. Verificando status das cotas..."
if quotaon -p / | grep -q "user quota on"; then
    echo "✓ Cotas de usuário ativadas"
else
    echo "✗ Erro ao ativar cotas de usuário"
    exit 1
fi

if quotaon -p / | grep -q "group quota on"; then
    echo "✓ Cotas de grupo ativadas"
else
    echo "✗ Erro ao ativar cotas de grupo"
    exit 1
fi

# 8. Reiniciar serviços
echo "8. Reiniciando serviços..."
systemctl start apache2 2>/dev/null || systemctl start nginx 2>/dev/null
systemctl start hestia

# 9. Aguardar HestiaCP inicializar
echo "9. Aguardando HestiaCP inicializar..."
sleep 10

# 10. Testar funcionalidade de cotas
echo "10. Testando funcionalidade..."
if command -v repquota >/dev/null 2>&1; then
    echo "✓ Comando repquota funcionando"
    repquota / | head -5
else
    echo "✗ Comando repquota não encontrado"
    exit 1
fi

echo ""
echo "=== CONFIGURAÇÃO CONCLUÍDA ==="
echo "✓ Cotas de disco configuradas e funcionando"
echo "✓ HestiaCP pode agora aplicar limites automaticamente"
echo ""
echo "Agora você pode:"
echo "1. Acessar o painel HestiaCP"
echo "2. Ir em Usuários → Editar usuário"
echo "3. Definir o limite de disco (ex: 1.5GB)"
echo "4. O limite será aplicado automaticamente"
echo ""
echo "Para verificar cotas no terminal:"
echo "repquota -a"
