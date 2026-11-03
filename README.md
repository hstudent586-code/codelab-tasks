# КодЛаб · CI/CD-пайплайн у GitHub Actions

Навчальний прототип до курсової роботи «Створення CI/CD-пайплайну для хмарного середовища компанії-розробника «КодЛаб»».
Компанія і задачі умовні.

Застосунок `codelab-tasks` – невеликий сервіс задач клієнтських проєктів (TypeScript, Fastify, PostgreSQL).
Головне в проєкті – пайплайн, який при кожній зміні коду сам перевіряє, тестує, збирає, сканує і розгортає застосунок.

```
push → Статичний аналіз ─┐
       Тести (+PostgreSQL)┴→ Образ і сканування → staging → [підтвердження] → production
```

| Етап | Що відбувається |
|---|---|
| Статичний аналіз | ESLint, перевірка типів TypeScript, `npm audit` робочих залежностей |
| Тести | модульні та інтеграційні тести з PostgreSQL у service-контейнері, поріг покриття 80 % |
| Образ і сканування | багатоетапний Dockerfile, сканування Trivy, публікація в GitHub Container Registry (amd64 + arm64) |
| Staging | розгортання на сервері `codelab` (self-hosted runner), перевірка версії і димові тести, автоматичний відкат |
| Production | те саме після ручного підтвердження в середовищі `production` |
| Release | тег `vX.Y.Z` → образ із семантичними тегами і сторінка релізу |

Дії GitHub Actions закріплено за повними хешами комітів, Dependabot щотижня пропонує оновлення.

## Налаштування (один раз)

1. **Репозиторій.** На GitHub створіть **публічний** репозиторій `codelab-tasks` без README і нічого поки не завантажуйте.
2. **Захист від чужих запусків.** Settings → Actions → General → «Approval for running fork pull request workflows from contributors» → **Require approval for all external contributors** → Save.
3. **Середовища.** Settings → Environments → New environment:
   - `staging` → Add environment secret `DB_PASSWORD` (будь-який пароль);
   - `production` → секрет `DB_PASSWORD` (інший пароль) і **Required reviewers** – ваш логін → Save protection rules.
4. **Сервер розгортання (ваш Mac).** Settings → Actions → Runners → New self-hosted runner → macOS, ARM64.
   Виконайте показані команди в новій папці (наприклад `~/actions-runner`). Коли `config.sh` спитає про мітки
   (additional labels), введіть `codelab`, на інші питання – Enter. Потім `./run.sh` і не закривайте це вікно Термінала.
   Docker Desktop має бути запущений.
5. **Код.** В іншому вікні Термінала:
   ```bash
   cd ~/Desktop/students/codelab
   git init -b main && git add . && git commit -m "Початкова версія"
   git remote add origin https://github.com/<ваш-логін>/codelab-tasks.git
   git push -u origin main
   ```
   Якщо git попросить пароль, введіть не пароль від GitHub, а токен: Settings (профілю) → Developer settings →
   Personal access tokens → Tokens (classic) → Generate new token з правами `repo` і `workflow`.
   Пайплайн запуститься сам: Actions → CI/CD.

## Корисне

- staging: http://localhost:8281, production: http://localhost:8282
- відкат: Actions → **Manual deploy / rollback** → середовище і попередній образ
- випуск версії: `git tag v1.0.0 && git push origin v1.0.0`
- сценарій для скриншотів: `docs/screenshots.md`
- локально: `npm ci && npm test` (інтеграційні тести – з `DATABASE_URL`), `npm run dev`
- прибрати обидва середовища з даними: `scripts/cleanup.sh`
