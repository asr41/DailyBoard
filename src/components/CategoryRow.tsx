import { useState, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task, Category, Group, MutateFn, AppMode } from "../types";
import { TaskCard } from "./TaskCard";
import type { ColType } from "./TaskCard";
import { ConfirmDialog } from "./ConfirmDialog";
import { api } from "../api";

const NOW = () => new Date().toISOString();

interface Props {
  category: Category;
  groups: Group[];
  notStarted: Task[];
  inProgress: Task[];
  visibleCompleted: Task[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, multi: boolean) => void;
  onSelectRange: (ids: string[]) => void;
  catSelected: boolean;
  selectedCatIds: Set<string>;
  onToggleCatSelect: (id: string, multi: boolean) => void;
  onShiftSelectCat: (id: string) => void;
  onOpenDetail: (task: Task) => void;
  mode: AppMode;
  mutate: MutateFn;
}

function DroppableCol({ id, variant, children }: { id: string; variant: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`task-col task-col--${variant}${isOver ? " task-col--over" : ""}`}>
      {children}
    </div>
  );
}

export function CategoryRow({
  category, groups,
  notStarted, inProgress, visibleCompleted,
  selectedIds, onToggleSelect, onSelectRange,
  catSelected, selectedCatIds, onToggleCatSelect, onShiftSelectCat,
  onOpenDetail,
  mode,
  mutate,
}: Props) {
  const [confirmState,   setConfirmState]   = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [groupMenuOpen,  setGroupMenuOpen]  = useState(false);
  const [newGroupMode,   setNewGroupMode]   = useState(false);
  const [newGroupName,   setNewGroupName]   = useState("");
  const [renamingPopup,  setRenamingPopup]  = useState(false);
  const [nameInput,      setNameInput]      = useState(category.name);
  const [addingTask,     setAddingTask]     = useState(false);
  const [newTaskName,    setNewTaskName]    = useState("");

  const lastSelectedRef = useRef<{ taskId: string; col: ColType } | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cat:${category.id}`,
    data: { type: "cat", catId: category.id },
  });

  const rowStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : "auto",
    position: "relative",
  };

  // ── Category actions ─────────────────────────────────
  const catBatchIds = catSelected && selectedCatIds.size > 1 ? [...selectedCatIds] : [category.id];

  const commitRename = () => {
    const n = nameInput.trim();
    if (n && n !== category.name) mutate(() => api.renameCategory(category.id, n));
  };

  const handleArchiveCat = () => {
    mutate(() => api.archiveCategories(catBatchIds));
    setMenuOpen(false);
  };

  const handleDeleteCat = () => {
    const label = catBatchIds.length > 1 ? `${catBatchIds.length} categories` : `"${category.name}"`;
    setMenuOpen(false);
    setConfirmState({
      message: `Delete ${label} and all their tasks?`,
      onConfirm: () => {
        setConfirmState(null);
        mutate(() => api.deleteCategories(catBatchIds));
      },
    });
  };

  const closeGroupMenu = () => {
    setGroupMenuOpen(false);
    setNewGroupMode(false);
    setNewGroupName("");
  };

  const handleMoveToGroup = (groupId: string | null) => {
    mutate(() => api.moveCategoriesToGroup(catBatchIds, groupId));
    closeGroupMenu();
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    mutate(async () => {
      const newGroup = await api.createGroup(name);
      await api.moveCategoriesToGroup(catBatchIds, newGroup.id);
    });
    closeGroupMenu();
  };

  // ── Task actions ─────────────────────────────────────
  const handleAddTask = () => {
    const n = newTaskName.trim();
    if (!n) { setAddingTask(false); return; }
    mutate(() => api.addTask(category.id, n, ""));
    setNewTaskName("");
    setAddingTask(false);
  };

  const makeTaskHandlers = (task: Task, col: ColType) => {
    const handleToggle = (id: string, multi: boolean) => {
      onToggleSelect(id, multi);
      if (!multi) lastSelectedRef.current = { taskId: id, col };
    };

    const handleShift = (targetId: string) => {
      const colTasks = col === "not_started" ? notStarted
                     : col === "in_progress" ? inProgress
                     : visibleCompleted;
      const anchor = lastSelectedRef.current;
      if (!anchor || anchor.col !== col) {
        onToggleSelect(targetId, false);
        lastSelectedRef.current = { taskId: targetId, col };
        return;
      }
      const ai = colTasks.findIndex(t => t.id === anchor.taskId);
      const ti = colTasks.findIndex(t => t.id === targetId);
      if (ai === -1 || ti === -1) { onToggleSelect(targetId, false); return; }
      const [lo, hi] = ai <= ti ? [ai, ti] : [ti, ai];
      onSelectRange(colTasks.slice(lo, hi + 1).map(t => t.id));
    };

    const isBatch = selectedIds.has(task.id) && selectedIds.size > 1;
    const batchIds = [...selectedIds];

    return {
      onToggleSelect: handleToggle,
      onShiftSelect: handleShift,
      onToggleComplete: () => mutate(() => api.updateTask(task.id, {
        state: col === "completed"
          ? "NotStarted"
          : { Completed: { completed_date: NOW() } },
        name: null, category_id: null, description: null, priority: null,
        due_date: null, remove_due_date: null, recurrence: null, remove_recurrence: null,
      })),
      onArchive: () => mutate(async () => {
        if (isBatch) {
          await api.updateTasks(batchIds, {
            state: { Archived: { archived_date: NOW() } }, name: null, category_id: null,
            description: null, priority: null, due_date: null, remove_due_date: null, recurrence: null, remove_recurrence: null,
          });
        } else {
          await api.updateTask(task.id, {
            state: { Archived: { archived_date: NOW() } }, name: null, category_id: null,
            description: null, priority: null, due_date: null, remove_due_date: null, recurrence: null, remove_recurrence: null,
          });
        }
      }),
      onDelete: () => mutate(() => isBatch ? api.deleteTasks(batchIds) : api.deleteTasks([task.id])),
      onOpenDetail: () => onOpenDetail(task),
    };
  };

  const taskCard = (task: Task, col: ColType) => {
    const h = makeTaskHandlers(task, col);
    return (
      <TaskCard
        key={task.id}
        task={task}
        col={col}
        color={category.display_color}
        selected={selectedIds.has(task.id)}
        mode={mode}
        onToggleSelect={h.onToggleSelect}
        onShiftSelect={h.onShiftSelect}
        onToggleComplete={h.onToggleComplete}
        onOpenDetail={h.onOpenDetail}
        onArchive={h.onArchive}
        onDelete={h.onDelete}
      />
    );
  };

  return (
    <>
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
      <div ref={setNodeRef} style={rowStyle} className="category-row">
        {/* Category label */}
        <div
          className="cat-label"
          style={{
            color: category.display_color,
            borderColor: category.display_color + "40",
            cursor: isDragging ? "grabbing" : "pointer",
            outline: catSelected ? "2px solid var(--accent)" : undefined,
            outlineOffset: catSelected ? "2px" : undefined,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (e.shiftKey) { onShiftSelectCat(category.id); return; }
            onToggleCatSelect(category.id, e.ctrlKey || e.metaKey);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen(true);
            setGroupMenuOpen(false);
          }}
          {...listeners}
          {...attributes}
        >
          <span className="cat-label-text">{category.name}</span>

          {/* ── Regular context menu ───────────────────── */}
          {menuOpen && !groupMenuOpen && !renamingPopup && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 199 }}
                onMouseDown={() => setMenuOpen(false)}
              />
              <div
                className="cat-menu"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
              >
                {catBatchIds.length === 1 && (
                  <>
                    <button
                      className="cat-menu-item"
                      onClick={() => { setRenamingPopup(true); setNameInput(category.name); setMenuOpen(false); }}
                    >
                      Rename
                    </button>
                    <div className="cat-menu-sep" />
                  </>
                )}
                <button
                  className="cat-menu-item"
                  onClick={() => { setMenuOpen(false); setGroupMenuOpen(true); }}
                >
                  Group
                </button>
                <div className="cat-menu-sep" />
                <button className="cat-menu-item" onClick={handleArchiveCat}>Archive</button>
                <button className="cat-menu-item cat-menu-item--danger" onClick={handleDeleteCat}>Delete</button>
              </div>
            </>
          )}

          {/* ── Rename popup ───────────────────────────── */}
          {renamingPopup && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 199 }}
                onMouseDown={() => { setRenamingPopup(false); setNameInput(category.name); }}
              />
              <div
                className="cat-menu"
                style={{ minWidth: 200 }}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ padding: "0 0 8px" }}>
                  <div className="group-picker-head">Rename</div>
                  <div style={{ padding: "6px 8px 0" }}>
                  <input
                    autoFocus
                    className="group-name-input"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { commitRename(); setRenamingPopup(false); }
                      if (e.key === "Escape") { setRenamingPopup(false); setNameInput(category.name); }
                    }}
                    onBlur={() => { commitRename(); setRenamingPopup(false); }}
                  />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Group picker ───────────────────────────── */}
          {groupMenuOpen && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 199 }}
                onMouseDown={closeGroupMenu}
              />
              <div
                className="cat-menu"
                style={{ minWidth: 180 }}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
              >
                <div className="group-picker-head">Group</div>

                <button
                  className="cat-menu-item group-picker-item"
                  onClick={() => handleMoveToGroup(null)}
                >
                  <span className="group-check">{!category.group_id ? "✓" : ""}</span>
                  None
                </button>

                {groups.length > 0 && <div className="cat-menu-sep" />}

                {groups.map(g => (
                  <button
                    key={g.id}
                    className="cat-menu-item group-picker-item"
                    onClick={() => handleMoveToGroup(g.id)}
                  >
                    <span className="group-check">{category.group_id === g.id ? "✓" : ""}</span>
                    {g.name}
                  </button>
                ))}

                <div className="cat-menu-sep" />

                {newGroupMode ? (
                  <div style={{ padding: "4px 6px 6px" }}>
                    <input
                      autoFocus
                      className="group-name-input"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleCreateGroup();
                        if (e.key === "Escape") { setNewGroupMode(false); setNewGroupName(""); }
                      }}
                      placeholder="Group name…"
                    />
                  </div>
                ) : (
                  <button className="cat-menu-item" onClick={() => setNewGroupMode(true)}>
                    + New Group…
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Not Started */}
        <DroppableCol id={`col:${category.id}:not_started`} variant="ns">
          {notStarted.map(t => taskCard(t, "not_started"))}
          {addingTask ? (
            <div className="add-task-card" onMouseDown={e => e.preventDefault()}>
              <input
                autoFocus
                className="add-ghost-input"
                maxLength={40}
                value={newTaskName}
                onChange={e => setNewTaskName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddTask();
                  if (e.key === "Escape") { setAddingTask(false); setNewTaskName(""); }
                }}
                onBlur={() => { setAddingTask(false); setNewTaskName(""); }}
                placeholder="Task name…"
              />
            </div>
          ) : (
            <button
              className="btn-add-task"
              onPointerDown={e => e.stopPropagation()}
              onClick={() => setAddingTask(true)}
            >
              +
            </button>
          )}
        </DroppableCol>

        {/* In Progress */}
        <DroppableCol id={`col:${category.id}:in_progress`} variant="ip">
          {inProgress.map(t => taskCard(t, "in_progress"))}
        </DroppableCol>

        {/* Completed */}
        <DroppableCol id={`col:${category.id}:completed`} variant="done">
          {visibleCompleted.map(t => taskCard(t, "completed"))}
        </DroppableCol>
      </div>
    </>
  );
}
