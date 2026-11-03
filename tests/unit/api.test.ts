import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { MemoryRepo } from "../../src/repo.js";

const info = { version: "1.2.3", commit: "abcdef1234567", builtAt: "2026-11-03T10:00:00Z", env: "staging" };
let app: FastifyInstance;

beforeEach(() => {
  app = buildApp(new MemoryRepo(), info);
});
afterEach(async () => {
  await app.close();
});

const create = (body: object) => app.inject({ method: "POST", url: "/api/tasks", payload: body });

describe("перевірки стану", () => {
  it("/health і /ready відповідають 200", async () => {
    expect((await app.inject("/health")).statusCode).toBe(200);
    expect((await app.inject("/ready")).json()).toEqual({ status: "ready" });
  });

  it("/ready повертає 503 без бази даних", async () => {
    const repo = new MemoryRepo();
    repo.ping = async () => {
      throw new Error("down");
    };
    const a = buildApp(repo, info);
    expect((await a.inject("/ready")).statusCode).toBe(503);
    await a.close();
  });

  it("/api/version показує дані збірки", async () => {
    expect((await app.inject("/api/version")).json()).toEqual(info);
  });
});

describe("задачі", () => {
  it("створює задачу і повертає 201", async () => {
    const r = await create({ project: "shop", title: "Оплата карткою", priority: "high" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ id: 1, project: "SHOP", status: "todo", priority: "high" });
  });

  it("повертає 422 з переліком помилок полів", async () => {
    const r = await create({ project: "", title: "x" });
    expect(r.statusCode).toBe(422);
    expect(r.json().errors).toHaveProperty("project");
    expect(r.json().errors).toHaveProperty("title");
  });

  it("фільтрує за станом і проєктом", async () => {
    await create({ project: "SHOP", title: "Перша задача" });
    await create({ project: "CRM", title: "Друга задача" });
    await app.inject({ method: "PATCH", url: "/api/tasks/2", payload: { status: "doing" } });
    expect((await app.inject("/api/tasks?project=shop")).json()).toHaveLength(1);
    expect((await app.inject("/api/tasks?status=doing")).json()[0].id).toBe(2);
    expect((await app.inject("/api/tasks?status=bad")).statusCode).toBe(422);
  });

  it("змінює стан за дозволеним переходом і відхиляє недозволений", async () => {
    await create({ project: "SHOP", title: "Переходи" });
    expect((await app.inject({ method: "PATCH", url: "/api/tasks/1", payload: { status: "done" } })).statusCode).toBe(422);
    const r = await app.inject({ method: "PATCH", url: "/api/tasks/1", payload: { status: "doing" } });
    expect(r.json().status).toBe("doing");
  });

  it("видаляє задачу, повторне видалення – 404", async () => {
    await create({ project: "SHOP", title: "Тимчасова" });
    expect((await app.inject({ method: "DELETE", url: "/api/tasks/1" })).statusCode).toBe(204);
    expect((await app.inject({ method: "DELETE", url: "/api/tasks/1" })).statusCode).toBe(404);
    expect((await app.inject("/api/tasks/1")).statusCode).toBe(404);
    expect((await app.inject("/api/tasks/abc")).statusCode).toBe(422);
  });

  it("рахує задачі за станами", async () => {
    await create({ project: "SHOP", title: "Перша задача" });
    await create({ project: "SHOP", title: "Друга задача" });
    await app.inject({ method: "PATCH", url: "/api/tasks/1", payload: { status: "doing" } });
    expect((await app.inject("/api/stats")).json()).toEqual({ todo: 1, doing: 1, review: 0, done: 0 });
  });

  it("некоректний JSON дає 400", async () => {
    const r = await app.inject({ method: "POST", url: "/api/tasks", payload: "{bad", headers: { "content-type": "application/json" } });
    expect(r.statusCode).toBe(400);
  });

  it("невідома помилка сховища дає 500 без подробиць", async () => {
    const repo = new MemoryRepo();
    repo.list = async () => {
      throw new Error("секрет");
    };
    const a = buildApp(repo, info);
    const r = await a.inject("/api/tasks");
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain("секрет");
    await a.close();
  });
});

describe("сторінка", () => {
  it("показує середовище і коміт", async () => {
    const r = await app.inject("/");
    expect(r.headers["content-type"]).toContain("text/html");
    expect(r.body).toContain("тестове середовище (staging)");
    expect(r.body).toContain("abcdef1");
  });

  it("робоче середовище має зелену смугу", async () => {
    const a = buildApp(new MemoryRepo(), { ...info, env: "production" });
    expect((await a.inject("/")).body).toContain("#15803d");
    await a.close();
  });

  it("метадані станів", async () => {
    expect((await app.inject("/api/meta")).json().statuses).toHaveLength(4);
  });
});
