#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
SSL_DIR="${ROOT_DIR}/nginx/ssl"

rand_hex() {
  local bytes="${1:-32}"
  openssl rand -hex "${bytes}"
}

rand_alnum() {
  local chars="${1:-40}"
  local bytes=$(( (chars + 1) / 2 ))
  openssl rand -hex "${bytes}" | cut -c "1-${chars}"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need_cmd openssl

if [[ -f "${ENV_FILE}" ]]; then
  echo ".env already exists; leaving it unchanged."
else
  echo "Creating .env with random local secrets..."
  cp "${ROOT_DIR}/.env.example" "${ENV_FILE}"

  POSTGRES_PASSWORD="$(rand_alnum 40)"
  REDIS_PASSWORD="$(rand_alnum 40)"
  JWT_SECRET="$(rand_hex 32)"
  JWT_REFRESH_SECRET="$(rand_hex 32)"
  SESSION_SECRET="$(rand_hex 24)"
  MFA_ENCRYPTION_KEY="$(openssl rand -base64 32)"
  INVITE_CODE="$(rand_alnum 48)"

  sed -i.bak \
    -e "s/CHANGE_ME_DB_PASSWORD/${POSTGRES_PASSWORD}/g" \
    -e "s/CHANGE_ME_REDIS_PASSWORD/${REDIS_PASSWORD}/g" \
    -e "s/CHANGE_ME_LONG_RANDOM_SECRET_MIN_64_CHARS/${JWT_SECRET}/g" \
    -e "s/CHANGE_ME_DIFFERENT_LONG_RANDOM_SECRET_MIN_64_CHARS/${JWT_REFRESH_SECRET}/g" \
    -e "s/CHANGE_ME_SESSION_SECRET/${SESSION_SECRET}/g" \
    -e "s|CHANGE_ME_BASE64_32_BYTE_KEY|${MFA_ENCRYPTION_KEY}|g" \
    -e "s/CHANGE_ME_LONG_RANDOM_INVITE_CODE/${INVITE_CODE}/g" \
    "${ENV_FILE}"
  rm -f "${ENV_FILE}.bak"

  echo "Created .env"
  echo "Registration invite code: ${INVITE_CODE}"
fi

mkdir -p "${SSL_DIR}"
if [[ -f "${SSL_DIR}/cert.pem" && -f "${SSL_DIR}/key.pem" ]]; then
  echo "Local TLS certificate already exists; leaving it unchanged."
else
  echo "Generating local self-signed TLS certificate for localhost..."
  openssl req -x509 -nodes -newkey rsa:4096 -sha256 -days 365 \
    -keyout "${SSL_DIR}/key.pem" \
    -out "${SSL_DIR}/cert.pem" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
  chmod 600 "${SSL_DIR}/key.pem"
  echo "Created nginx/ssl/cert.pem and nginx/ssl/key.pem"
fi

echo ""
echo "Bootstrap complete."
echo "Start with prebuilt images:"
echo "  docker compose -p cybertabletop -f docker-compose.pull.yml up -d"
