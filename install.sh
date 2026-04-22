#!/usr/bin/env bash
# =============================================================================
# CyberTabletop – Install Script
# Supports: Ubuntu/Debian, RHEL/CentOS/Fedora, macOS
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
fatal()   { error "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo -e "${BOLD}${CYAN}"
cat <<'BANNER'
  ____      _               _____     _     _      _
 / ___|   _| |__   ___ _ __|_   _|_ _| |__ | | ___| |_ ___  _ __
| |  | | | | '_ \ / _ \ '__| | |/ _` | '_ \| |/ _ \ __/ _ \| '_ \
| |__| |_| | |_) |  __/ |    | | (_| | |_) | |  __/ || (_) | |_) |
 \____\__, |_.__/ \___|_|    |_|\__,_|_.__/|_|\___|\__\___/| .__/
      |___/                                                  |_|
BANNER
echo -e "${RESET}"
echo -e "${BOLD}CyberTabletop Installation Script${RESET}"
echo "=================================================="
echo ""

# ---------------------------------------------------------------------------
# Root check
# ---------------------------------------------------------------------------
if [[ $EUID -eq 0 ]]; then
    warn "Running as root. This is not recommended for local development."
    warn "Some commands (nvm, npm) work better as a regular user."
    echo ""
fi

# ---------------------------------------------------------------------------
# Detect script directory (project root)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
info "Project root: ${SCRIPT_DIR}"

# ---------------------------------------------------------------------------
# Detect OS
# ---------------------------------------------------------------------------
OS=""
OS_PRETTY=""

if [[ "$(uname -s)" == "Darwin" ]]; then
    OS="macos"
    OS_PRETTY="macOS $(sw_vers -productVersion)"
elif [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    source /etc/os-release
    case "${ID:-}" in
        ubuntu|debian|linuxmint|pop)
            OS="debian"
            OS_PRETTY="${PRETTY_NAME:-Ubuntu/Debian}"
            ;;
        rhel|centos|fedora|rocky|almalinux|ol)
            OS="rhel"
            OS_PRETTY="${PRETTY_NAME:-RHEL/CentOS/Fedora}"
            ;;
        *)
            warn "Unrecognised OS ID='${ID:-unknown}'. Attempting Debian-style installation."
            OS="debian"
            OS_PRETTY="${PRETTY_NAME:-Unknown Linux}"
            ;;
    esac
else
    fatal "Cannot determine operating system. /etc/os-release not found."
fi

info "Detected OS: ${OS_PRETTY}"
echo ""

# ---------------------------------------------------------------------------
# Helper: command exists
# ---------------------------------------------------------------------------
cmd_exists() { command -v "$1" &>/dev/null; }

# ---------------------------------------------------------------------------
# Install Docker Engine + Docker Compose plugin
# ---------------------------------------------------------------------------
install_docker() {
    if cmd_exists docker; then
        DOCKER_VERSION=$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')
        success "Docker already installed: ${DOCKER_VERSION}"
    else
        info "Installing Docker Engine…"
        case "${OS}" in
            debian)
                sudo apt-get update -qq
                sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
                sudo install -m 0755 -d /etc/apt/keyrings
                curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
                    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
                sudo chmod a+r /etc/apt/keyrings/docker.gpg
                # Fallback for non-Ubuntu Debian derivatives
                DIST_ID=$(. /etc/os-release && echo "${ID}")
                CODENAME=$(. /etc/os-release && echo "${VERSION_CODENAME:-$(lsb_release -cs)}")
                echo \
                    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${DIST_ID} ${CODENAME} stable" \
                    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
                sudo apt-get update -qq
                sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
                    docker-buildx-plugin docker-compose-plugin
                sudo systemctl enable --now docker
                # Allow current user to run docker without sudo
                if [[ $EUID -ne 0 ]]; then
                    sudo usermod -aG docker "${USER}" || true
                    warn "Added ${USER} to 'docker' group. Log out and back in for this to take effect."
                fi
                ;;
            rhel)
                sudo dnf -y install dnf-plugins-core 2>/dev/null \
                    || sudo yum -y install yum-utils
                sudo dnf config-manager --add-repo \
                    https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null \
                    || sudo yum-config-manager --add-repo \
                       https://download.docker.com/linux/centos/docker-ce.repo
                sudo dnf -y install docker-ce docker-ce-cli containerd.io \
                    docker-buildx-plugin docker-compose-plugin 2>/dev/null \
                    || sudo yum -y install docker-ce docker-ce-cli containerd.io \
                       docker-buildx-plugin docker-compose-plugin
                sudo systemctl enable --now docker
                if [[ $EUID -ne 0 ]]; then
                    sudo usermod -aG docker "${USER}" || true
                    warn "Added ${USER} to 'docker' group. Log out and back in for this to take effect."
                fi
                ;;
            macos)
                if cmd_exists brew; then
                    brew install --cask docker
                    warn "Docker Desktop installed. Please open Docker Desktop and complete setup before continuing."
                    warn "Re-run this script once Docker Desktop is running."
                    exit 0
                else
                    fatal "Homebrew not found. Install it from https://brew.sh then re-run this script."
                fi
                ;;
        esac
        success "Docker installed."
    fi

    # Verify Docker Compose plugin
    if docker compose version &>/dev/null; then
        DC_VERSION=$(docker compose version --short 2>/dev/null || docker compose version | awk '{print $NF}')
        success "Docker Compose plugin available: ${DC_VERSION}"
    else
        fatal "Docker Compose plugin not found. Check your Docker installation."
    fi

    # Start Docker daemon if not running (Linux)
    if [[ "${OS}" != "macos" ]]; then
        if ! docker info &>/dev/null; then
            sudo systemctl start docker || fatal "Unable to start Docker daemon."
        fi
    fi
}

# ---------------------------------------------------------------------------
# Install Node.js 20 LTS via nvm
# ---------------------------------------------------------------------------
install_nodejs() {
    NVM_DIR="${HOME}/.nvm"
    NODE_VERSION="20"

    # Install nvm if not present
    if [[ ! -d "${NVM_DIR}" ]]; then
        info "Installing nvm…"
        curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    else
        info "nvm already present at ${NVM_DIR}"
    fi

    # Source nvm
    # shellcheck source=/dev/null
    export NVM_DIR="${NVM_DIR}"
    [[ -s "${NVM_DIR}/nvm.sh" ]] && source "${NVM_DIR}/nvm.sh"

    if ! cmd_exists nvm; then
        fatal "nvm could not be loaded. Please open a new shell and re-run the script."
    fi

    # Install / use Node 20
    if nvm ls "${NODE_VERSION}" &>/dev/null; then
        info "Node.js ${NODE_VERSION} already installed via nvm."
        nvm use "${NODE_VERSION}" --silent
    else
        info "Installing Node.js ${NODE_VERSION} LTS via nvm…"
        nvm install "${NODE_VERSION}"
        nvm use "${NODE_VERSION}"
        nvm alias default "${NODE_VERSION}"
    fi

    NODE_VER=$(node --version 2>/dev/null)
    NPM_VER=$(npm --version 2>/dev/null)
    success "Node.js ${NODE_VER} / npm ${NPM_VER}"
}

# ---------------------------------------------------------------------------
# Install Git
# ---------------------------------------------------------------------------
install_git() {
    if cmd_exists git; then
        success "Git already installed: $(git --version)"
        return
    fi
    info "Installing Git…"
    case "${OS}" in
        debian) sudo apt-get install -y -qq git ;;
        rhel)   sudo dnf -y install git 2>/dev/null || sudo yum -y install git ;;
        macos)  brew install git ;;
    esac
    cmd_exists git || fatal "Git installation failed."
    success "Git installed: $(git --version)"
}

# ---------------------------------------------------------------------------
# Install openssl
# ---------------------------------------------------------------------------
install_openssl() {
    if cmd_exists openssl; then
        success "openssl already installed: $(openssl version)"
        return
    fi
    info "Installing openssl…"
    case "${OS}" in
        debian) sudo apt-get install -y -qq openssl ;;
        rhel)   sudo dnf -y install openssl 2>/dev/null || sudo yum -y install openssl ;;
        macos)  brew install openssl ;;
    esac
    cmd_exists openssl || fatal "openssl installation failed."
    success "openssl installed: $(openssl version)"
}

# ---------------------------------------------------------------------------
# Verify all critical tools
# ---------------------------------------------------------------------------
verify_installs() {
    info "Verifying installations…"
    local failed=0
    for tool in docker git openssl node npm; do
        if cmd_exists "${tool}"; then
            success "  ${tool}: $(command -v "${tool}")"
        else
            error "  ${tool}: NOT FOUND"
            (( failed++ )) || true
        fi
    done
    if ! docker compose version &>/dev/null; then
        error "  docker compose plugin: NOT FOUND"
        (( failed++ )) || true
    else
        success "  docker compose: available"
    fi
    [[ ${failed} -eq 0 ]] || fatal "${failed} tool(s) missing. Check errors above."
}

# ---------------------------------------------------------------------------
# Create nginx/ssl directory
# ---------------------------------------------------------------------------
create_ssl_dir() {
    SSL_DIR="${SCRIPT_DIR}/nginx/ssl"
    if [[ ! -d "${SSL_DIR}" ]]; then
        info "Creating ${SSL_DIR}…"
        mkdir -p "${SSL_DIR}"
    fi
    success "nginx/ssl directory ready: ${SSL_DIR}"
}

# ---------------------------------------------------------------------------
# Generate self-signed TLS certificates
# ---------------------------------------------------------------------------
generate_certs() {
    SSL_DIR="${SCRIPT_DIR}/nginx/ssl"
    CERT="${SSL_DIR}/cert.pem"
    KEY="${SSL_DIR}/key.pem"

    if [[ -f "${CERT}" && -f "${KEY}" ]]; then
        warn "TLS certificates already exist. Skipping generation."
        warn "Delete ${SSL_DIR}/cert.pem and key.pem to regenerate."
        return
    fi

    info "Generating self-signed TLS certificate (2-year expiry)…"
    openssl req -x509 -nodes \
        -newkey rsa:4096 \
        -keyout "${KEY}" \
        -out "${CERT}" \
        -days 730 \
        -subj "/C=US/ST=State/L=City/O=CyberTabletop/OU=Dev/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
        2>/dev/null
    chmod 600 "${KEY}"
    chmod 644 "${CERT}"
    success "TLS certificates written to ${SSL_DIR}/"
}

# ---------------------------------------------------------------------------
# Copy .env.example → .env
# ---------------------------------------------------------------------------
setup_env_file() {
    ENV_FILE="${SCRIPT_DIR}/.env"
    ENV_EXAMPLE="${SCRIPT_DIR}/.env.example"

    if [[ ! -f "${ENV_EXAMPLE}" ]]; then
        fatal ".env.example not found at ${SCRIPT_DIR}. Cannot continue."
    fi

    if [[ -f "${ENV_FILE}" ]]; then
        warn ".env already exists. Skipping copy (secrets will still be regenerated if placeholders remain)."
    else
        cp "${ENV_EXAMPLE}" "${ENV_FILE}"
        success "Copied .env.example to .env"
    fi
}

# ---------------------------------------------------------------------------
# Generate secure random values and inject into .env
# ---------------------------------------------------------------------------
generate_secrets() {
    ENV_FILE="${SCRIPT_DIR}/.env"
    info "Generating secure random secrets…"

    # 64 hex chars (256-bit)
    gen_hex64()  { openssl rand -hex 32; }
    # 32 hex chars (128-bit)
    gen_hex32()  { openssl rand -hex 16; }
    # 32 alphanumeric chars
    gen_alnum32() {
        local chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        local result=""
        local raw
        raw=$(openssl rand -base64 48)
        # Filter to alphanumeric only, take first 32
        result=$(echo "${raw}" | tr -dc 'A-Za-z0-9' | head -c 32)
        echo "${result}"
    }

    JWT_SECRET=$(gen_hex64)
    JWT_REFRESH_SECRET=$(gen_hex64)
    SESSION_SECRET=$(gen_hex32)
    MFA_ENCRYPTION_KEY=$(openssl rand -base64 32)
    POSTGRES_PASSWORD=$(gen_alnum32)
    REDIS_PASSWORD=$(gen_alnum32)
    INVITE_CODE=$(openssl rand -base64 72 | tr -dc 'A-Za-z0-9' | head -c 48)

    # Replace placeholder values in .env
    # Works for both "KEY=PLACEHOLDER" and "KEY=changeme" patterns
    replace_env_var() {
        local key="$1"
        local value="$2"
        # Escape special characters for sed replacement
        local escaped_value
        escaped_value=$(printf '%s\n' "${value}" | sed 's/[&/\]/\\&/g')
        # Match key=<anything> and replace the value portion
        if grep -qE "^${key}=" "${ENV_FILE}"; then
            sed -i.bak "s|^${key}=.*|${key}=${escaped_value}|" "${ENV_FILE}"
        else
            echo "${key}=${value}" >> "${ENV_FILE}"
        fi
    }

    replace_env_var "JWT_SECRET"          "${JWT_SECRET}"
    replace_env_var "JWT_REFRESH_SECRET"  "${JWT_REFRESH_SECRET}"
    replace_env_var "SESSION_SECRET"      "${SESSION_SECRET}"
    replace_env_var "MFA_ENCRYPTION_KEY"  "${MFA_ENCRYPTION_KEY}"
    replace_env_var "POSTGRES_PASSWORD"   "${POSTGRES_PASSWORD}"
    replace_env_var "REDIS_PASSWORD"      "${REDIS_PASSWORD}"
    replace_env_var "INVITE_CODE"         "${INVITE_CODE}"

    # Remove sed backup file
    rm -f "${ENV_FILE}.bak"

    success "Secrets written to .env"
    info "  JWT_SECRET:          ${JWT_SECRET:0:16}… (truncated)"
    info "  JWT_REFRESH_SECRET:  ${JWT_REFRESH_SECRET:0:16}… (truncated)"
    info "  SESSION_SECRET:      ${SESSION_SECRET:0:8}… (truncated)"
    info "  MFA_ENCRYPTION_KEY:  ${MFA_ENCRYPTION_KEY:0:8}… (truncated)"
    info "  POSTGRES_PASSWORD:   ${POSTGRES_PASSWORD:0:8}… (truncated)"
    info "  REDIS_PASSWORD:      ${REDIS_PASSWORD:0:8}… (truncated)"
    info "  INVITE_CODE:         ${INVITE_CODE}"
    echo ""
    warn "Save this INVITE_CODE. Use it when registering the first SUPER_ADMIN account."
}

# ---------------------------------------------------------------------------
# Pre-fetch Docker images
# ---------------------------------------------------------------------------
pull_images() {
    info "Pre-fetching prebuilt Docker images (docker-compose.pull.yml)..."
    cd "${SCRIPT_DIR}"
    if docker compose -p cybertabletop -f docker-compose.pull.yml pull; then
        success "Docker images pulled."
    else
        warn "Some images could not be pulled. They will be pulled on first 'docker compose -p cybertabletop -f docker-compose.pull.yml up -d'."
    fi
}

# ---------------------------------------------------------------------------
# Success message
# ---------------------------------------------------------------------------
print_success() {
    echo ""
    echo -e "${GREEN}${BOLD}============================================================${RESET}"
    echo -e "${GREEN}${BOLD}  CyberTabletop installation complete!${RESET}"
    echo -e "${GREEN}${BOLD}============================================================${RESET}"
    echo ""
    echo -e "${BOLD}Next steps:${RESET}"
    echo ""
    echo -e "  ${YELLOW}1.${RESET} ${BOLD}(Optional)${RESET} Edit ${CYAN}.env${RESET} to configure SSO providers or AI integrations:"
    echo -e "       ${CYAN}nano ${SCRIPT_DIR}/.env${RESET}"
    echo ""
    echo -e "  ${YELLOW}2.${RESET} Start all services:"
    echo -e "       ${CYAN}docker compose -p cybertabletop -f docker-compose.pull.yml up -d${RESET}"
    echo ""
    echo -e "       ${CYAN}Database migrations and built-in scenarios are applied automatically when the backend starts.${RESET}"
    echo ""
    echo -e "  ${YELLOW}3.${RESET} Open the application:"
    echo -e "       ${CYAN}https://localhost${RESET}"
    echo -e "       ${YELLOW}(Accept the self-signed certificate warning in your browser)${RESET}"
    echo ""
    echo -e "  ${YELLOW}4.${RESET} Register your admin account:"
    echo -e "       The ${BOLD}first account registered${RESET} is automatically granted ${BOLD}SUPER_ADMIN${RESET} role."
    echo -e "       Privileged users must complete TOTP MFA setup before using the app."
    echo ""
    echo -e "${GREEN}${BOLD}============================================================${RESET}"
    echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    install_docker
    echo ""
    install_git
    install_openssl
    echo ""

    # Source nvm for subsequent Node usage
    export NVM_DIR="${HOME}/.nvm"
    [[ -s "${NVM_DIR}/nvm.sh" ]] && source "${NVM_DIR}/nvm.sh" || true

    install_nodejs
    echo ""
    verify_installs
    echo ""
    create_ssl_dir
    generate_certs
    echo ""
    setup_env_file
    generate_secrets
    echo ""
    pull_images
    print_success
}

main "$@"
