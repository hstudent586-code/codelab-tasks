// Предметна область: задачі клієнтських проєктів «КодЛаб».

export const STATUSES = ["todo", "doing", "review", "done"] as const;
export const PRIORITIES = ["low", "normal", "high"] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_TITLES: Record<Status, string> = {
  todo: "До виконання",
  doing: "У роботі",
  review: "На перевірці",
  done: "Готово",
};

export interface Task {
  id: number;
  project: string;
  title: string;
  assignee: string | null;
  priority: Priority;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export interface NewTask {
  project: string;
  title: string;
  assignee?: string | null;
  priority?: Priority;
}

/** Дозволені переходи між станами задачі. */
const NEXT: Record<Status, Status[]> = {
  todo: ["doing"],
  doing: ["review", "todo"],
  review: ["done", "doing"],
  done: [],
};

export function canMove(from: Status, to: Status): boolean {
  return NEXT[from].includes(to);
}

export class ValidationError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super("Перевірте введені дані");
  }
}

export class NotFoundError extends Error {}

/** Перевіряє нову задачу і повертає нормалізовані значення. */
export function validateNewTask(input: unknown): Required<NewTask> {
  const errors: Record<string, string> = {};
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const project = typeof o.project === "string" ? o.project.trim().toUpperCase() : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const assignee = typeof o.assignee === "string" && o.assignee.trim() !== "" ? o.assignee.trim() : null;
  const priority = (o.priority ?? "normal") as Priority;

  if (!/^[A-Z]{2,6}$/.test(project)) errors.project = "код проєкту – 2–6 латинських літер";
  if (title.length < 3 || title.length > 120) errors.title = "назва – від 3 до 120 символів";
  if (assignee !== null && assignee.length > 60) errors.assignee = "ім'я виконавця – до 60 символів";
  if (!PRIORITIES.includes(priority)) errors.priority = "пріоритет: low, normal або high";
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return { project, title, assignee, priority };
}

export function validateStatus(from: Status, to: unknown): Status {
  if (typeof to !== "string" || !STATUSES.includes(to as Status)) {
    throw new ValidationError({ status: "невідомий стан" });
  }
  if (!canMove(from, to as Status)) {
    throw new ValidationError({ status: `перехід «${STATUS_TITLES[from]}» → «${STATUS_TITLES[to as Status]}» не дозволено` });
  }
  return to as Status;
}
