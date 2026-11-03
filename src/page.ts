// Сторінка дошки задач. Колір смуги показує середовище: тестове – помаранчевий, робоче – зелений.
import type { BuildInfo } from "./app.js";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function page(info: BuildInfo): string {
  const envTitle: Record<string, string> = { staging: "тестове середовище (staging)", production: "робоче середовище (production)", local: "локальний запуск" };
  const color = info.env === "production" ? "#15803d" : info.env === "staging" ? "#c2410c" : "#475569";
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>КодЛаб · Задачі</title>
<style>
:root { --env: ${color}; --ink: #1e293b; --muted: #64748b; --line: #e2e8f0; --bg: #f8fafc; }
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: var(--bg); }
.env { background: var(--env); color: #fff; padding: 8px 24px; display: flex; justify-content: space-between; gap: 16px; font-size: 14px; flex-wrap: wrap; }
.env code { background: rgba(255,255,255,.18); padding: 1px 6px; border-radius: 4px; }
header { padding: 18px 24px 4px; display: flex; align-items: baseline; gap: 14px; }
header h1 { margin: 0; font-size: 22px; } header span { color: var(--muted); }
form { display: flex; gap: 8px; padding: 10px 24px; flex-wrap: wrap; }
input, select, button { font: inherit; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; }
button { background: var(--ink); color: #fff; border: 0; cursor: pointer; }
button.small { padding: 2px 8px; font-size: 13px; background: #e2e8f0; color: var(--ink); }
.board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 10px 24px 30px; }
.col { background: #eef2f7; border-radius: 10px; padding: 10px; min-height: 200px; }
.col h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); margin: 2px 4px 10px; display: flex; justify-content: space-between; }
.card { background: #fff; border-radius: 8px; padding: 9px 11px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.07); border-left: 3px solid #94a3b8; }
.card.high { border-left-color: #dc2626; } .card.low { border-left-color: #cbd5e1; }
.card .p { font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; }
.card .t { margin: 3px 0 6px; font-weight: 600; }
.err { color: #dc2626; padding: 0 24px; min-height: 20px; }
</style></head>
<body>
<div class="env"><b>${esc(envTitle[info.env] ?? info.env)}</b>
<span>версія <code>${esc(info.version)}</code> · коміт <code>${esc(info.commit.slice(0, 7))}</code> · зібрано ${esc(info.builtAt)}</span></div>
<header><h1>КодЛаб · Задачі проєктів</h1><span id="sum"></span></header>
<form id="f">
  <input name="project" placeholder="Код проєкту, напр. SHOP" maxlength="6" size="18">
  <input name="title" placeholder="Назва задачі" size="40">
  <input name="assignee" placeholder="Виконавець">
  <select name="priority"><option value="normal">звичайний</option><option value="high">високий</option><option value="low">низький</option></select>
  <button>Додати задачу</button>
</form>
<div class="err" id="err"></div>
<div class="board" id="board"></div>
<script>
const NEXT = { todo: ["doing"], doing: ["review", "todo"], review: ["done", "doing"], done: [] };
const T = { todo: "До виконання", doing: "У роботі", review: "На перевірці", done: "Готово" };
const P = { high: "високий", normal: "звичайний", low: "низький" };
const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
async function load() {
  const tasks = await (await fetch("/api/tasks")).json();
  document.getElementById("sum").textContent = "задач: " + tasks.length;
  document.getElementById("board").innerHTML = Object.keys(T).map((s) => {
    const list = tasks.filter((t) => t.status === s);
    return '<div class="col"><h2>' + T[s] + "<span>" + list.length + "</span></h2>" + list.map((t) =>
      '<div class="card ' + t.priority + '"><div class="p"><span>' + e(t.project) + "-" + t.id + "</span><span>" + P[t.priority] + "</span></div>" +
      '<div class="t">' + e(t.title) + '</div><div class="p"><span>' + e(t.assignee || "—") + "</span><span>" +
      NEXT[s].map((n) => '<button class="small" data-id="' + t.id + '" data-to="' + n + '">' + (n === "todo" || (s === "review" && n === "doing") ? "←" : "→") + " " + T[n] + "</button>").join(" ") +
      "</span></div></div>").join("") + "</div>";
  }).join("");
  document.querySelectorAll("[data-to]").forEach((b) => (b.onclick = async () => {
    const r = await fetch("/api/tasks/" + b.dataset.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: b.dataset.to }) });
    if (!r.ok) document.getElementById("err").textContent = (await r.json()).error;
    load();
  }));
}
document.getElementById("f").onsubmit = async (ev) => {
  ev.preventDefault();
  const body = Object.fromEntries(new FormData(ev.target));
  const r = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  document.getElementById("err").textContent = r.ok ? "" : Object.values(j.errors || {}).join("; ") || j.error;
  if (r.ok) ev.target.reset();
  load();
};
load();
</script>
</body></html>`;
}
