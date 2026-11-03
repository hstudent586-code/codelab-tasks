// Сховище задач: у пам'яті (модульні тести) і PostgreSQL (робочі середовища, інтеграційні тести).
import pg from "pg";
import { NotFoundError, type NewTask, type Status, type Task } from "./domain.js";

export interface TaskFilter {
  status?: Status;
  project?: string;
}

export interface TaskRepo {
  list(filter?: TaskFilter): Promise<Task[]>;
  get(id: number): Promise<Task>;
  create(t: Required<NewTask>): Promise<Task>;
  setStatus(id: number, status: Status): Promise<Task>;
  remove(id: number): Promise<void>;
  stats(): Promise<Record<Status, number>>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

const emptyStats = (): Record<Status, number> => ({ todo: 0, doing: 0, review: 0, done: 0 });

export class MemoryRepo implements TaskRepo {
  private tasks = new Map<number, Task>();
  private seq = 0;

  async list(f: TaskFilter = {}): Promise<Task[]> {
    return [...this.tasks.values()]
      .filter((t) => (!f.status || t.status === f.status) && (!f.project || t.project === f.project))
      .sort((a, b) => b.id - a.id);
  }

  async get(id: number): Promise<Task> {
    const t = this.tasks.get(id);
    if (!t) throw new NotFoundError(`Задачу ${id} не знайдено`);
    return t;
  }

  async create(n: Required<NewTask>): Promise<Task> {
    const now = new Date().toISOString();
    const t: Task = { id: ++this.seq, ...n, status: "todo", createdAt: now, updatedAt: now };
    this.tasks.set(t.id, t);
    return t;
  }

  async setStatus(id: number, status: Status): Promise<Task> {
    const t = await this.get(id);
    const u = { ...t, status, updatedAt: new Date().toISOString() };
    this.tasks.set(id, u);
    return u;
  }

  async remove(id: number): Promise<void> {
    if (!this.tasks.delete(id)) throw new NotFoundError(`Задачу ${id} не знайдено`);
  }

  async stats(): Promise<Record<Status, number>> {
    const s = emptyStats();
    for (const t of this.tasks.values()) s[t.status]++;
    return s;
  }

  async ping(): Promise<void> {}
  async close(): Promise<void> {}
}

interface Row {
  id: number;
  project: string;
  title: string;
  assignee: string | null;
  priority: Task["priority"];
  status: Status;
  created_at: Date;
  updated_at: Date;
}

const toTask = (r: Row): Task => ({
  id: r.id,
  project: r.project,
  title: r.title,
  assignee: r.assignee,
  priority: r.priority,
  status: r.status,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export const MIGRATION = `
CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  project     VARCHAR(6)   NOT NULL,
  title       VARCHAR(120) NOT NULL,
  assignee    VARCHAR(60),
  priority    VARCHAR(6)   NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  status      VARCHAR(6)   NOT NULL DEFAULT 'todo'   CHECK (status IN ('todo','doing','review','done')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks (project);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status);
`;

export class PgRepo implements TaskRepo {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 3000 });
  }

  /** Створює таблиці, якщо їх немає; кілька спроб – база може ще запускатися. */
  async migrate(attempts = 10, delayMs = 1000): Promise<void> {
    for (let i = 1; ; i++) {
      try {
        await this.pool.query(MIGRATION);
        return;
      } catch (e) {
        if (i >= attempts) throw e;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  async list(f: TaskFilter = {}): Promise<Task[]> {
    const cond: string[] = [];
    const args: unknown[] = [];
    if (f.status) {
      args.push(f.status);
      cond.push(`status = $${args.length}`);
    }
    if (f.project) {
      args.push(f.project);
      cond.push(`project = $${args.length}`);
    }
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const r = await this.pool.query<Row>(`SELECT * FROM tasks ${where} ORDER BY id DESC LIMIT 500`, args);
    return r.rows.map(toTask);
  }

  async get(id: number): Promise<Task> {
    const r = await this.pool.query<Row>("SELECT * FROM tasks WHERE id = $1", [id]);
    if (!r.rows[0]) throw new NotFoundError(`Задачу ${id} не знайдено`);
    return toTask(r.rows[0]);
  }

  async create(n: Required<NewTask>): Promise<Task> {
    const r = await this.pool.query<Row>(
      "INSERT INTO tasks (project, title, assignee, priority) VALUES ($1, $2, $3, $4) RETURNING *",
      [n.project, n.title, n.assignee, n.priority],
    );
    return toTask(r.rows[0]!);
  }

  async setStatus(id: number, status: Status): Promise<Task> {
    const r = await this.pool.query<Row>("UPDATE tasks SET status = $2, updated_at = now() WHERE id = $1 RETURNING *", [id, status]);
    if (!r.rows[0]) throw new NotFoundError(`Задачу ${id} не знайдено`);
    return toTask(r.rows[0]);
  }

  async remove(id: number): Promise<void> {
    const r = await this.pool.query("DELETE FROM tasks WHERE id = $1", [id]);
    if (r.rowCount === 0) throw new NotFoundError(`Задачу ${id} не знайдено`);
  }

  async stats(): Promise<Record<Status, number>> {
    const r = await this.pool.query<{ status: Status; n: string }>("SELECT status, count(*) AS n FROM tasks GROUP BY status");
    const s = emptyStats();
    for (const row of r.rows) s[row.status] = Number(row.n);
    return s;
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
