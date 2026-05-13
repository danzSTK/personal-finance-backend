#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_ENV_FILE="$ROOT_DIR/.env.bitwarden.local"
RUNTIME_ENV_FILE="${BWS_RUNTIME_ENV_FILE:-$ROOT_DIR/.env.bws.runtime}"

log() {
  printf '%s\n' "$*" >&2
}

die() {
  log "Erro: $*"
  exit 1
}

need() {
  local name="$1"

  if [ -z "${!name:-}" ]; then
    die "Variável obrigatória ausente: $name"
  fi
}

need_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    die "Comando obrigatório não encontrado: $command_name"
  fi
}

usage() {
  cat >&2 <<EOF
Uso:
  scripts/with-bws-dev.sh <comando>

Exemplos:
  cd api && ../scripts/with-bws-dev.sh npm run start:dev
  ./scripts/with-bws-dev.sh docker compose up -d --build
EOF
}

if [ "$#" -eq 0 ]; then
  usage
  exit 64
fi

if [ ! -f "$LOCAL_ENV_FILE" ]; then
  die "Arquivo não encontrado: $LOCAL_ENV_FILE"
fi

set -a
source "$LOCAL_ENV_FILE"
set +a

need_command bws
need_command jq

need BWS_ACCESS_TOKEN

BWS_SECRET_MAP=(
  "POSTGRES_DB:BWS_POSTGRES_DB_ID"
  "POSTGRES_USER:BWS_POSTGRES_USER_ID"
  "POSTGRES_PASSWORD:BWS_POSTGRES_PASSWORD_ID"
  "POSTGRES_HOST:BWS_POSTGRES_HOST_ID"
  "JWT_ACCESS_SECRET:BWS_JWT_ACCESS_SECRET_ID"
  "JWT_REFRESH_SECRET:BWS_JWT_REFRESH_SECRET_ID"
  "GOOGLE_CLIENT_ID:BWS_GOOGLE_CLIENT_ID_ID"
  "GOOGLE_CLIENT_SECRET:BWS_GOOGLE_CLIENT_SECRET_ID"
  "REDIS_HOST:BWS_REDIS_HOST_ID"
  "REDIS_PORT:BWS_REDIS_PORT_ID"
  "REDIS_PASSWORD:BWS_REDIS_PASSWORD_ID"
)

LOCAL_ENV_VARS=(
  "POSTGRES_PORT"
  "NODE_ENV"
  "PORT"
  "APP_URL"
  "JWT_ACCESS_EXPIRES_IN"
  "JWT_REFRESH_EXPIRES_IN"
  "GOOGLE_CALLBACK_URL"
  "GOOGLE_LINK_CALLBACK_URI"
  "FRONTEND_URL"
  "REDIS_TTL"
  "THROTTLE_DEFAULT_TTL"
  "THROTTLE_DEFAULT_LIMIT"
  "THROTTLE_AUTH_SIGNIN_TTL"
  "THROTTLE_AUTH_SIGNIN_LIMIT"
  "THROTTLE_AUTH_SIGNIN_BLOCKED_TTL"
  "THROTTLE_AUTH_SIGNUP_TTL"
  "THROTTLE_AUTH_SIGNUP_LIMIT"
  "THROTTLE_AUTH_SIGNUP_BLOCKED_TTL"
  "CSRF_ALLOWED_ORIGINS"
)

RUNTIME_ENV_VARS=(
  "POSTGRES_DB"
  "POSTGRES_USER"
  "POSTGRES_PASSWORD"
  "POSTGRES_HOST"
  "POSTGRES_PORT"
  "NODE_ENV"
  "APP_URL"
  "PORT"
  "JWT_ACCESS_SECRET"
  "JWT_REFRESH_SECRET"
  "JWT_ACCESS_EXPIRES_IN"
  "JWT_REFRESH_EXPIRES_IN"
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
  "GOOGLE_CALLBACK_URL"
  "GOOGLE_LINK_CALLBACK_URI"
  "FRONTEND_URL"
  "REDIS_HOST"
  "REDIS_PORT"
  "REDIS_PASSWORD"
  "REDIS_TTL"
  "THROTTLE_DEFAULT_TTL"
  "THROTTLE_DEFAULT_LIMIT"
  "THROTTLE_AUTH_SIGNIN_TTL"
  "THROTTLE_AUTH_SIGNIN_LIMIT"
  "THROTTLE_AUTH_SIGNIN_BLOCKED_TTL"
  "THROTTLE_AUTH_SIGNUP_TTL"
  "THROTTLE_AUTH_SIGNUP_LIMIT"
  "THROTTLE_AUTH_SIGNUP_BLOCKED_TTL"
  "CSRF_ALLOWED_ORIGINS"
)

secret_value() {
  local target_name="$1"
  local secret_id="$2"
  local value

  if ! value="$(bws secret get "$secret_id" --output json | jq -er '.value // empty')"; then
    die "Não foi possível buscar $target_name no Bitwarden"
  fi

  if [ -z "$value" ]; then
    die "Segredo vazio no Bitwarden: $target_name"
  fi

  printf '%s' "$value"
}

export_secret() {
  local target_name="$1"
  local id_var_name="$2"
  local value

  need "$id_var_name"
  value="$(secret_value "$target_name" "${!id_var_name}")"
  export "$target_name=$value"
}

assert_single_line() {
  local name="$1"
  local value="${!name}"

  case "$value" in
    *$'\n'* | *$'\r'*)
      die "A variável $name contém quebra de linha e não pode ser escrita em env_file"
      ;;
  esac
}

write_runtime_env_file() {
  local tmp_file

  tmp_file="$(mktemp "$RUNTIME_ENV_FILE.XXXXXX")"

  {
    printf '# Gerado por scripts/with-bws-dev.sh. Não commitar.\n'
    printf '# Origem dos segredos: Bitwarden Secrets Manager.\n'

    local name
    for name in "${RUNTIME_ENV_VARS[@]}"; do
      need "$name"
      assert_single_line "$name"
      printf '%s=%s\n' "$name" "${!name}"
    done
  } >"$tmp_file"

  chmod 600 "$tmp_file"
  mv "$tmp_file" "$RUNTIME_ENV_FILE"
}

has_env_file_arg() {
  local arg

  for arg in "$@"; do
    if [ "$arg" = "--env-file" ] || [[ "$arg" == --env-file=* ]]; then
      return 0
    fi
  done

  return 1
}

for item in "${BWS_SECRET_MAP[@]}"; do
  target_name="${item%%:*}"
  id_var_name="${item#*:}"
  export_secret "$target_name" "$id_var_name"
done

for name in "${LOCAL_ENV_VARS[@]}"; do
  need "$name"
  export "$name"
done

write_runtime_env_file
log "Env gerado em: $RUNTIME_ENV_FILE"

if [ "${1:-}" = "docker" ] && [ "${2:-}" = "compose" ]; then
  export API_ENV_FILE="$RUNTIME_ENV_FILE"

  if has_env_file_arg "$@"; then
    exec docker compose --project-directory "$ROOT_DIR" "${@:3}"
  fi

  exec docker compose --project-directory "$ROOT_DIR" --env-file "$RUNTIME_ENV_FILE" "${@:3}"
fi

if [ "${1:-}" = "docker-compose" ]; then
  export API_ENV_FILE="$RUNTIME_ENV_FILE"

  if has_env_file_arg "$@"; then
    exec docker-compose --project-directory "$ROOT_DIR" "${@:2}"
  fi

  exec docker-compose --project-directory "$ROOT_DIR" --env-file "$RUNTIME_ENV_FILE" "${@:2}"
fi

exec "$@"
