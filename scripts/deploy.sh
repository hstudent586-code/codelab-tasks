#!/usr/bin/env bash
# Розгортання образу в середовище з перевіркою і автоматичним відкатом.
# Виконується на сервері розгортання (self-hosted runner «codelab»).
#   DB_PASSWORD=... scripts/deploy.sh staging ghcr.io/owner/repo:sha-1234567 [коміт]
set -euo pipefail
ENV_NAME="${1:?середовище: staging або production}"
IMAGE="${2:?образ}"
EXPECT_SHA="${3:-}"
case "$ENV_NAME" in
  staging) HOST_PORT=8281 ;;
  production) HOST_PORT=8282 ;;
  *) echo "невідоме середовище $ENV_NAME" >&2; exit 2 ;;
esac
cd "$(dirname "$0")/.."
STATE_DIR="$HOME/.codelab-deploy"
mkdir -p "$STATE_DIR"
PREVIOUS="$(cat "$STATE_DIR/$ENV_NAME.image" 2>/dev/null || true)"
export IMAGE APP_ENV="$ENV_NAME" HOST_PORT DB_PASSWORD="${DB_PASSWORD:?не задано секрет DB_PASSWORD}"
compose() { docker compose -p "codelab-$ENV_NAME" -f deploy/compose.yml "$@"; }

echo "== $ENV_NAME: $IMAGE (попередній: ${PREVIOUS:-немає})"
docker pull -q "$IMAGE"
if compose up -d --wait --wait-timeout 120 && bash scripts/smoke.sh "http://localhost:$HOST_PORT" "$EXPECT_SHA"; then
  echo "$IMAGE" > "$STATE_DIR/$ENV_NAME.image"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_DIR/$ENV_NAME.time"
  compose ps
  echo "== $ENV_NAME оновлено: http://localhost:$HOST_PORT"
  exit 0
fi

echo "== перевірка не пройшла, відкат" >&2
compose logs --tail 40 app >&2 || true
if [ -n "$PREVIOUS" ]; then
  IMAGE="$PREVIOUS" compose up -d --wait --wait-timeout 120
  echo "== відновлено попередню версію $PREVIOUS" >&2
else
  compose down
  echo "== попередньої версії немає, середовище зупинено" >&2
fi
exit 1
