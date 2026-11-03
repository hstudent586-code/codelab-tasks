#!/usr/bin/env bash
# Димові тести розгорнутого середовища: стан, версія і повний цикл задачі через API.
#   scripts/smoke.sh http://localhost:8281 [очікуваний-коміт]
set -euo pipefail
URL="${1:?адреса середовища}"
EXPECT_SHA="${2:-}"
fail() { echo "ПОМИЛКА: $*" >&2; exit 1; }
code() { curl -s -o /tmp/smoke_body.$$ -w '%{http_code}' "$@"; }
body() { cat /tmp/smoke_body.$$; }
trap 'rm -f /tmp/smoke_body.$$' EXIT

[ "$(code "$URL/health")" = 200 ] || fail "/health"
[ "$(code "$URL/ready")" = 200 ] || fail "/ready – немає з'єднання з базою"
[ "$(code "$URL/api/version")" = 200 ] || fail "/api/version"
echo "версія: $(body)"
if [ -n "$EXPECT_SHA" ]; then
  body | grep -q "\"commit\":\"$EXPECT_SHA\"" || fail "розгорнуто не той коміт (очікувався $EXPECT_SHA)"
fi

[ "$(code -X POST -H 'Content-Type: application/json' -d '{"project":"SMOKE","title":"Перевірка після розгортання"}' "$URL/api/tasks")" = 201 ] || fail "створення задачі: $(body)"
ID=$(body | sed -E 's/.*"id":([0-9]+).*/\1/')
[ "$(code -X PATCH -H 'Content-Type: application/json' -d '{"status":"doing"}' "$URL/api/tasks/$ID")" = 200 ] || fail "зміна стану"
[ "$(code -X PATCH -H 'Content-Type: application/json' -d '{"status":"todo2"}' "$URL/api/tasks/$ID")" = 422 ] || fail "очікувалась помилка 422"
[ "$(code -X DELETE "$URL/api/tasks/$ID")" = 204 ] || fail "видалення задачі"
[ "$(code "$URL/api/tasks/$ID")" = 404 ] || fail "задача не видалилась"
echo "димові тести пройдено: $URL"
