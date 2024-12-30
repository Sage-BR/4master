#!/bin/bash

# Função para exibir mensagens coloridas
function echo_info {
    echo -e "\e[34m[INFO]\e[0m $1"
}

function echo_success {
    echo -e "\e[32m[SUCCESS]\e[0m $1"
}

function echo_error {
    echo -e "\e[31m[ERROR]\e[0m $1"
}

# Verifica se o script está sendo executado como root
if [ "$EUID" -ne 0 ]; then
    echo_error "Este script deve ser executado como root."
    exit 1
fi

# Solicita informações ao usuário
read -p "Digite o nome do usuário administrador do MariaDB: " mariadb_user
read -sp "Digite a senha para o usuário $mariadb_user: " mariadb_password
echo
read -p "Digite a porta que o MariaDB deve usar [default: 3306]: " mariadb_port
mariadb_port=${mariadb_port:-3306}
read -p "Permitir conexões remotas? (y/n) [default: n]: " allow_remote
allow_remote=${allow_remote:-n}

# Atualiza pacotes e instala o MariaDB
echo_info "Atualizando pacotes e instalando o MariaDB..."
apt update && apt install -y mariadb-server mariadb-client
if [ $? -ne 0 ]; then
    echo_error "Falha ao instalar o MariaDB."
    exit 1
fi

# Configura o MariaDB
echo_info "Configurando o MariaDB..."
systemctl start mariadb
systemctl enable mariadb

# Verifica se o MariaDB está em execução
if ! systemctl is-active --quiet mariadb; then
    echo_error "O serviço MariaDB não está em execução."
    exit 1
fi

# Configura o arquivo de configuração do MariaDB
cat <<EOF > /etc/mysql/mariadb.conf.d/99-custom.cnf
[mysqld]
port = $mariadb_port
EOF

if [ "$allow_remote" == "y" ]; then
    echo_info "Habilitando conexões remotas..."
    echo "bind-address = 0.0.0.0" >> /etc/mysql/mariadb.conf.d/99-custom.cnf
fi

# Reinicia o MariaDB para aplicar as configurações
echo_info "Reiniciando o MariaDB para aplicar as configurações..."
systemctl restart mariadb

# Configura o usuário administrador e permissões
echo_info "Configurando usuário e permissões..."
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED VIA mysql_native_password;"
mysql -u root -e "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('$mariadb_password');"
mysql -u root -p"$mariadb_password" -e "CREATE USER IF NOT EXISTS '$mariadb_user'@'%' IDENTIFIED BY '$mariadb_password';"
mysql -u root -p"$mariadb_password" -e "GRANT ALL PRIVILEGES ON *.* TO '$mariadb_user'@'%' WITH GRANT OPTION;"
mysql -u root -p"$mariadb_password" -e "FLUSH PRIVILEGES;"

if [ "$allow_remote" == "y" ]; then
    mysql -u root -p"$mariadb_password" -e "ALTER USER 'root'@'%' IDENTIFIED VIA mysql_native_password USING PASSWORD('$mariadb_password');"
    mysql -u root -p"$mariadb_password" -e "GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;"
    mysql -u root -p"$mariadb_password" -e "FLUSH PRIVILEGES;"
fi

# Confirmação final
echo_success "Instalação e configuração do MariaDB concluídas."
echo_info "Usuário: $mariadb_user"
echo_info "Senha: (oculta)"
echo_info "Porta: $mariadb_port"
if [ "$allow_remote" == "y" ]; then
    echo_info "Conexões remotas: Habilitadas"
else
    echo_info "Conexões remotas: Desabilitadas"
fi
