// TypeScript types mirror Rust structs/enums.
// Rust serializes with snake_case field names by default (serde).
// Rust enum variants serialize as:
//   - Unit variant → plain string: "NotStarted", "Normal"
//   - Struct variant → { VariantName: { field: value } }

export type Priority = "Normal" | "High";
export type RecurrenceUnit = "Hours" | "Days" | "Weeks" | "Months" | "Years";
export type CategoryStatus = "Active" | "Archived" | "Completed";

export type TaskState =
  | "NotStarted"
  | { InProgress: { start_date: string } }
  | { Completed: { completed_date: string } }
  | { Archived: { archived_date: string } };

export type HideCompletedPolicy =
  | "Immediately"
  | { AfterHours: { num_hours: number } }
  | { AfterDays: { num_days: number } };

export interface Recurrence {
  interval: number;
  unit: RecurrenceUnit;
  cycle_start: string;
  streak: number;
  longest_streak: number;
}

export interface Task {
  id: string;
  name: string;
  category_id: string;
  description: string;
  created_date: string;
  state: TaskState;
  priority: Priority;
  due_date: string | null;
  recurrence: Recurrence | null;
  completed_history: string[];
}

// Partial update sent to Rust. Omitted fields default to None (requires #[serde(default)] on TaskUpdate).
// Rust ignores start_date/completed_date in state transitions — it sets them via Utc::now() internally.
// So for state transitions, send a placeholder timestamp.
export interface TaskUpdate {
  name?: string | null;
  category_id?: string | null;
  description?: string | null;
  state?: TaskState | null;
  due_date?: string | null;
  recurrence?: RecurrenceInput | null;
  remove_recurrence?: boolean | null;
  remove_due_date?: boolean | null;
  priority?: Priority | null;
}

export interface RecurrenceInput {
  interval: number;
  unit: RecurrenceUnit;
  start_date?: string | null;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  display_color: string;
  order: number;
  group_id: string | null;
  status: CategoryStatus;
}

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface Settings {
  hide_completed_delay: HideCompletedPolicy;
  auto_clear_completed_days: number | null;
}

export interface AppData {
  not_started: Task[];
  in_progress: Task[];
  visible_completed: Task[];
  completed: Task[];
  archived: Task[];
  categories: Category[];
  groups: Group[];
  settings: Settings;
}

// Helpers for narrowing TaskState
export function isInProgress(s: TaskState): s is { InProgress: { start_date: string } } {
  return typeof s === "object" && "InProgress" in s;
}
export function isCompleted(s: TaskState): s is { Completed: { completed_date: string } } {
  return typeof s === "object" && "Completed" in s;
}
export function isArchived(s: TaskState): s is { Archived: { archived_date: string } } {
  return typeof s === "object" && "Archived" in s;
}

export type MutateFn = (action: () => Promise<unknown>) => Promise<void>;

export type AppMode = "simple" | "default";
