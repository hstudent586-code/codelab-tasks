// Інтеграційні тести з реальним PostgreSQL. У пайплайні база запускається як service-контейнер,
// локально тести пропускаються, якщо DATABASE_URL не задано.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { PgRepo } from "../../src/repo.js";
import { buildApp } from "../../src/app.js";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("PostgreSQL", () => {
  let repo: PgRepo;

  beforeAll(async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    await c.query("DROP TABLE IF EXISTS tasks");
    await c.end();
    repo = new PgRepo(url!);
    await repo.migrate();
    await repo.migrate(); // повторна міграція не повинна падати
  });

  afterAll(async () => {
    await repo?.close();
  });

  it("зберігає, фільтрує, змінює і видаляє задачі", async () => {
    const a = await repo.create({ project: "SHOP", title: "Інтеграційна задача", assignee: "Тест", priority: "high" });
    await repo.create({ project: "CRM", title: "Друга задача", assignee: null, priority: "low" });
    expect(a.id).toBeGreaterThan(0);
    expect(await repo.list({ project: "SHOP" })).toHaveLength(1);
    const moved = await repo.setStatus(a.id, "doing");
    expect(moved.status).toBe("doing");
    expect((await repo.list({ status: "doing" }))[0]!.id).toBe(a.id);
    expect(await repo.stats()).toEqual({ todo: 1, doing: 1, review: 0, done: 0 });
    await repo.remove(a.id);
    await expect(repo.get(a.id)).rejects.toThrow();
    await expect(repo.remove(a.id)).rejects.toThrow();
    await expect(repo.setStatus(a.id, "done")).rejects.toThrow();
  });

  it("обмеження CHECK у базі не пропускає недопустимий стан", async () => {
    const t = await repo.create({ project: "QA", title: "Перевірка обмежень", assignee: null, priority: "normal" });
    await expect(repo.setStatus(t.id, "archived" as never)).rejects.toThrow();
  });

  it("API працює поверх PostgreSQL", async () => {
    const app = buildApp(repo, { version: "test", commit: "ci", builtAt: "-", env: "test" });
    expect((await app.inject("/ready")).statusCode).toBe(200);
    const r = await app.inject({ method: "POST", url: "/api/tasks", payload: { project: "API", title: "Через HTTP" } });
    expect(r.statusCode).toBe(201);
    expect((await app.inject(`/api/tasks/${r.json().id}`)).json().title).toBe("Через HTTP");
    await app.close();
  });
});
