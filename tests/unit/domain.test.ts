import { describe, expect, it } from "vitest";
import { canMove, ValidationError, validateNewTask, validateStatus } from "../../src/domain.js";

describe("перевірка нової задачі", () => {
  it("нормалізує код проєкту і пробіли", () => {
    const t = validateNewTask({ project: " shop ", title: "  Кошик  ", assignee: "  " });
    expect(t).toEqual({ project: "SHOP", title: "Кошик", assignee: null, priority: "normal" });
  });

  it("повертає всі помилки одразу", () => {
    try {
      validateNewTask({ project: "1", title: "ab", priority: "urgent", assignee: "x".repeat(61) });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(Object.keys((e as ValidationError).errors).sort()).toEqual(["assignee", "priority", "project", "title"]);
    }
  });

  it("відхиляє не-об'єкт", () => {
    expect(() => validateNewTask(null)).toThrow(ValidationError);
  });
});

describe("переходи між станами", () => {
  it("дозволяє тільки визначені переходи", () => {
    expect(canMove("todo", "doing")).toBe(true);
    expect(canMove("review", "done")).toBe(true);
    expect(canMove("todo", "done")).toBe(false);
    expect(canMove("done", "todo")).toBe(false);
  });

  it("повертає зрозуміле повідомлення про недозволений перехід", () => {
    expect(() => validateStatus("todo", "done")).toThrow(ValidationError);
    expect(() => validateStatus("todo", "archived")).toThrow(ValidationError);
    expect(validateStatus("doing", "review")).toBe("review");
  });
});
