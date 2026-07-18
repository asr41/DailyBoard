import type { Task } from "../types";

export function toEditorHtml(text: string): string {
  if (/<[a-zA-Z]/.test(text)) return text;
  if (!text) return "";
  return text
    .split("\n")
    .map(line =>
      `<div>${line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;") || "<br>"}</div>`
    )
    .join("");
}

export function lastCompletedISO(task: Task): string {
  if (task.completed_history.length > 0)
    return task.completed_history[task.completed_history.length - 1];
  if (typeof task.state === "object" && "Completed" in task.state)
    return task.state.Completed.completed_date;
  return "";
}

export function formatShortDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function archivedISO(task: Task): string {
  if (typeof task.state === "object" && "Archived" in task.state)
    return task.state.Archived.archived_date;
  return "";
}
