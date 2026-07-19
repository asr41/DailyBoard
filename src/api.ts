import { invoke } from "@tauri-apps/api/core";
import type { AppData, Category, Group, Settings, TaskUpdate } from "./types";

// Tauri auto-converts camelCase param names → snake_case for Rust (top-level params only).
// Nested struct fields (e.g. fields inside TaskUpdate) stay snake_case — Rust serde default.

export const api = {
  // Returns all data needed to render any page.
  getAllData: (): Promise<AppData> =>
    invoke("get_all_data"),

  // Runs startup hooks (recurring resets, due date promotions, auto-clear) then returns fresh data.
  // Call this on a 5-minute interval — not getAllData — so hooks actually run.
  refresh: (): Promise<AppData> =>
    invoke("refresh_and_get_data"),

  // --- Tasks ---
  addTask: (categoryId: string, name: string, description: string): Promise<void> =>
    invoke("add_task", { categoryId, name, description }),

  updateTask: (id: string, update: TaskUpdate): Promise<void> =>
    invoke("update_task", { id, update }),

  updateTasks: (ids: string[], update: TaskUpdate): Promise<number> =>
    invoke("update_tasks", { ids, update }),

  updateArchivedTask: (id: string, update: TaskUpdate): Promise<void> =>
    invoke("update_archived_task", { id, update }),

  updateArchivedTasks: (ids: string[], update: TaskUpdate): Promise<number> =>
    invoke("update_archived_tasks", { ids, update }),

  deleteTasks: (ids: string[]): Promise<void> =>
    invoke("delete_tasks", { ids }),

  // --- Categories ---
  addCategory: (name: string): Promise<Category> =>
    invoke("add_category", { name }),

  renameCategory: (id: string, name: string): Promise<void> =>
    invoke("rename_category", { id, name }),

  reorderCategories: (orderedIds: string[]): Promise<void> =>
    invoke("reorder_categories", { orderedIds }),

  deleteCategories: (ids: string[]): Promise<void> =>
    invoke("delete_categories", { ids }),

  archiveCategories: (ids: string[]): Promise<void> =>
    invoke("archive_categories", { ids }),

  unarchiveCategories: (ids: string[]): Promise<void> =>
    invoke("unarchive_categories", { ids }),

  moveCategoriesToGroup: (ids: string[], groupId: string | null): Promise<void> =>
    invoke("move_categories_to_group", { ids, groupId }),

  // --- Groups ---
  createGroup: (name: string): Promise<Group> =>
    invoke("create_group", { name }),

  renameGroup: (id: string, name: string): Promise<void> =>
    invoke("rename_group", { id, name }),

  deleteGroup: (id: string): Promise<void> =>
    invoke("delete_group", { id }),

  // --- Settings ---
  updateSettings: (settings: Settings): Promise<void> =>
    invoke("update_settings", { settings }),

  // --- Data / Storage ---
  getStoragePath: (): Promise<string> =>
    invoke("get_storage_path"),

  exportBoard: (exportPath: string): Promise<void> =>
    invoke("export_board", { exportPath }),

  importBoard: (importPath: string): Promise<void> =>
    invoke("import_board", { importPath }),

  changeStorageLocation: (chosenFolder: string): Promise<void> =>
    invoke("change_storage_location", { chosenFolder }),
};
