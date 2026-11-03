// Таблиця покриття для підсумку запуску GitHub Actions.
import { readFileSync } from "node:fs";
const s = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8")).total;
const names = { lines: "рядки", statements: "інструкції", functions: "функції", branches: "гілки" };
const rows = Object.entries(names).map(([k, n]) => `| ${n} | ${s[k].pct} % | ${s[k].covered}/${s[k].total} |`);
console.log(["### Покриття коду тестами", "| Метрика | % | Покрито |", "|---|---|---|", ...rows].join("\n"));
