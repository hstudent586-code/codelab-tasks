# Сценарій для скриншотів

Зберігайте в папку `screenshots` (вона не потрапляє в репозиторій). Браузер на весь екран, масштаб 100 %.

## A. Перший запуск

| № | Що зняти |
|---|---|
| 01 | Settings → Environments: два середовища, у production видно «Required reviewers» |
| 02 | Settings → Actions → Runners: runner з міткою `codelab` у стані Idle |
| 03 | Actions → CI/CD → запуск: граф джобів (lint, test → build → staging → production «Waiting») |
| 04 | Відкрити джоб «Тести»: кроки зелені, розгорнути крок з тестами (видно кількість тестів) |
| 05 | Підсумок запуску (Summary) унизу: таблиця покриття |
| 06 | Джоб «Образ і сканування»: крок Trivy з таблицею результату |
| 07 | Джоб staging: крок розгортання (видно «димові тести пройдено») |
| 08 | Браузер: http://localhost:8281 – помаранчева смуга staging з версією і комітом; додайте 3–4 задачі й пересуньте кілька |
| 09 | Запуск: кнопка «Review deployments» → вікно підтвердження production |
| 10 | Після підтвердження: усі джоби зелені |
| 11 | Браузер: http://localhost:8282 – зелена смуга production |
| 12 | Репозиторій → Packages → `codelab-tasks`: теги образу (sha-…, 1.0.N, main) |

## B. Помилка зупиняє пайплайн

Створіть гілку з помилкою в тесті і Pull Request:
```bash
git checkout -b broken-test
sed -i '' 's/toBe(201)/toBe(200)/' tests/unit/api.test.ts
git commit -am "Перевірка: тест падає" && git push -u origin broken-test
```
На GitHub → Compare & pull request → Create.

| № | Що зняти |
|---|---|
| 13 | Pull Request: перевірка «Тести» червона, кнопка злиття попереджає |
| 14 | Джоб «Тести»: текст помилки тесту (expected 201 to be 200). Розгортання не запускалось |

Закрийте PR без злиття (Close pull request) і поверніться: `git checkout main`.

## C. Нова версія, випуск і відкат

```bash
sed -i '' 's/КодЛаб · Задачі проєктів/КодЛаб · Задачі клієнтських проєктів/' src/page.ts
git commit -am "Оновлено заголовок дошки" && git push
```

| № | Що зняти |
|---|---|
| 15 | Actions: два запуски CI/CD, другий зелений; staging показує новий коміт і заголовок |
| 16 | `git tag v1.0.0 && git push origin v1.0.0` → Actions → Release зелений; сторінка Releases з переліком змін |
| 17 | Actions → Manual deploy / rollback → Run workflow: production, образ першої версії (`…:sha-` першого коміту з Packages) → зелений; production знову зі старим заголовком |
| 18 | Термінал: `docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"` – контейнери обох середовищ healthy |
| 19 | Вікно Термінала з `./run.sh`: журнал runner-а з виконаними джобами |
| 20 | Dependabot (Insights → Dependency graph → Dependabot або вкладка Pull requests, якщо з'явились) – за наявності |
