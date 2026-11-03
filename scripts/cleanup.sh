#!/usr/bin/env bash
# Видаляє обидва середовища разом з даними і стан розгортання на цьому комп'ютері.
cd "$(dirname "$0")/.." || exit 1
for e in staging production; do
  IMAGE=none APP_ENV=$e HOST_PORT=1 DB_PASSWORD=none docker compose -p "codelab-$e" -f deploy/compose.yml down -v
done
rm -rf "$HOME/.codelab-deploy"
echo "Середовища видалено."
