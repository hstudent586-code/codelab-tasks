// HTTP-застосунок: API задач, перевірки стану і сторінка дошки.
import Fastify, { type FastifyInstance } from "fastify";
import { NotFoundError, STATUSES, STATUS_TITLES, ValidationError, validateNewTask, validateStatus, type Status } from "./domain.js";
import type { TaskRepo } from "./repo.js";
import { page } from "./page.js";

/** Відомості про збірку: їх задає пайплайн під час збирання образу і розгортання. */
export interface BuildInfo {
  version: string;
  commit: string;
  builtAt: string;
  env: string;
}

export function buildApp(repo: TaskRepo, info: BuildInfo, logger = false): FastifyInstance {
  const app = Fastify({ logger });
  const started = Date.now();

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ValidationError) return reply.code(422).send({ error: err.message, errors: err.errors });
    if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
    const { statusCode, message } = err as { statusCode?: number; message?: string };
    if (statusCode && statusCode < 500) return reply.code(statusCode).send({ error: message ?? "Некоректний запит" });
    app.log.error(err);
    return reply.code(500).send({ error: "Внутрішня помилка сервера" });
  });

  const idParam = (raw: unknown): number => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) throw new ValidationError({ id: "некоректний номер задачі" });
    return id;
  };

  // Перевірка «живий»: процес відповідає (для HEALTHCHECK контейнера).
  app.get("/health", async () => ({ status: "ok", uptimeSec: Math.round((Date.now() - started) / 1000) }));

  // Перевірка «готовий»: є з'єднання з базою даних (для пайплайна після розгортання).
  app.get("/ready", async (_req, reply) => {
    try {
      await repo.ping();
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "db-unavailable" });
    }
  });

  app.get("/api/version", async () => info);

  app.get("/api/meta", async () => ({ statuses: STATUSES.map((s) => ({ id: s, title: STATUS_TITLES[s] })) }));

  app.get<{ Querystring: { status?: string; project?: string } }>("/api/tasks", async (req) => {
    const { status, project } = req.query;
    if (status && !STATUSES.includes(status as Status)) throw new ValidationError({ status: "невідомий стан" });
    return repo.list({ status: status as Status | undefined, project: project?.toUpperCase() });
  });

  app.get<{ Params: { id: string } }>("/api/tasks/:id", async (req) => repo.get(idParam(req.params.id)));

  app.post("/api/tasks", async (req, reply) => {
    const t = await repo.create(validateNewTask(req.body));
    return reply.code(201).send(t);
  });

  app.patch<{ Params: { id: string }; Body: { status?: unknown } }>("/api/tasks/:id", async (req) => {
    const id = idParam(req.params.id);
    const current = await repo.get(id);
    return repo.setStatus(id, validateStatus(current.status, req.body?.status));
  });

  app.delete<{ Params: { id: string } }>("/api/tasks/:id", async (req, reply) => {
    await repo.remove(idParam(req.params.id));
    return reply.code(204).send();
  });

  app.get("/api/stats", async () => repo.stats());

  app.get("/", async (_req, reply) => reply.type("text/html; charset=utf-8").send(page(info)));

  return app;
}
