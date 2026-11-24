import type { Task } from "../types";

// High priority first, then soonest due date (no due date last), then oldest created
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = a.priority === "High" ? 0 : 1;
    const pb = b.priority === "High" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    if (da !== db) return da - db;
    return new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
  });
}

// The backend only bumps the streak when the next cycle starts. While a recurring task sits completed in its
// current cycle, show the streak it's about to earn so completing feels immediate. Derived purely from data, so
// it survives refreshes and restarts and hands off seamlessly when the real value catches up.
export function displayStreak(task: Task): { streak: number; longest: number } {
  const rec = task.recurrence;
  if (!rec) return { streak: 0, longest: 0 };
  const pending = typeof task.state === "object" && "Completed" in task.state ? 1 : 0;
  const streak = rec.streak + pending;
  return { streak, longest: Math.max(rec.longest_streak, streak) };
}

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
