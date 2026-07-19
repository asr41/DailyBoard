import { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import type { AppData, MutateFn, Task, TaskState, TaskUpdate, AppMode } from "../types";
import { CategoryRow } from "../components/CategoryRow";
import { TaskDetailPanel } from "../components/TaskDetailPanel";

const NOW = () => new Date().toISOString();

type ColId = "not_started" | "in_progress" | "completed";

function colToState(col: ColId): TaskState {
  if (col === "not_started") return "NotStarted";
  if (col === "in_progress") return { InProgress: { start_date: NOW() } };
  return { Completed: { completed_date: NOW() } };
}

interface TaskDragData {
  type: "task";
  taskId: string;
  fromCatId: string;
  fromCol: ColId;
}

interface Props {
  data: AppData;
  mutate: MutateFn;
  mode: AppMode;
}

export function MainPage({ data, mutate, mode }: Props) {
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const lastSelectedCatRef = useRef<string | null>(null);

  const BOARD_ROW_H = 214; // --cat-row-h (210px) + category-row margin-bottom (4px)
  const outerRef       = useRef<HTMLDivElement>(null);
  const boardWrapRef   = useRef<HTMLDivElement>(null);
  const boardHeaderRef = useRef<HTMLDivElement>(null);
  const [scrollH,       setScrollH]       = useState<number | null>(null);
  const [panelFullPage, setPanelFullPage] = useState(false);

  useEffect(() => {
    const wrap = boardWrapRef.current;
    const hdr  = boardHeaderRef.current;
    if (!wrap || !hdr) return;
    const recalc = () => {
      const rows = Math.floor((wrap.clientHeight - hdr.offsetHeight) / BOARD_ROW_H);
      setScrollH(hdr.offsetHeight + rows * BOARD_ROW_H);
    };
    const obs = new ResizeObserver(recalc);
    obs.observe(wrap);
    recalc();
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setPanelFullPage(entry.contentRect.width <= 1300);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const [addingCat,      setAddingCat]      = useState(false);
  const [catName,        setCatName]        = useState("");
  const [activeTask,     setActiveTask]     = useState<Task | null>(null);
  const [detailTask,     setDetailTask]     = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const activeCategories = data.categories
    .filter(c => c.status === "Active")
    .sort((a, b) => a.order - b.order);

  const sortableIds = activeCategories.map(c => `cat:${c.id}`);

  // ── Task selection ─────────────────────────────────────
  const handleToggleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedCatIds(new Set());
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (multi) {
        next.has(id) ? next.delete(id) : next.add(id);
      } else {
        if (next.size === 1 && next.has(id)) next.clear();
        else { next.clear(); next.add(id); }
      }
      return next;
    });
  }, []);

  const handleSelectRange = useCallback((ids: string[]) => {
    setSelectedCatIds(new Set());
    setSelectedIds(new Set(ids));
  }, []);

  // ── Category selection ─────────────────────────────────
  const handleToggleCatSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds(new Set());
    if (!multi) lastSelectedCatRef.current = id;
    setSelectedCatIds(prev => {
      const next = new Set(prev);
      if (multi) {
        next.has(id) ? next.delete(id) : next.add(id);
      } else {
        if (next.size === 1 && next.has(id)) { next.clear(); lastSelectedCatRef.current = null; }
        else { next.clear(); next.add(id); }
      }
      return next;
    });
  }, []);

  const handleSelectCatRange = useCallback((targetId: string) => {
    setSelectedIds(new Set());
    const anchor = lastSelectedCatRef.current;
    if (!anchor) {
      setSelectedCatIds(new Set([targetId]));
      lastSelectedCatRef.current = targetId;
      return;
    }
    const ai = activeCategories.findIndex(c => c.id === anchor);
    const ti = activeCategories.findIndex(c => c.id === targetId);
    if (ai === -1 || ti === -1) { setSelectedCatIds(new Set([targetId])); return; }
    const [lo, hi] = ai <= ti ? [ai, ti] : [ti, ai];
    setSelectedCatIds(new Set(activeCategories.slice(lo, hi + 1).map(c => c.id)));
  }, [activeCategories]);

  const clearSelection = () => { setSelectedIds(new Set()); setSelectedCatIds(new Set()); };

  const handleOpenDetail = useCallback((task: Task) => {
    setSelectedIds(new Set([task.id]));
    setSelectedCatIds(new Set());
    setDetailTask(task);
  }, []);

  // ── Add category ───────────────────────────────────────
  const handleAddCategory = () => {
    const n = catName.trim();
    if (!n) return;
    mutate(() => import("../api").then(m => m.api.addCategory(n)));
    setCatName("");
    setAddingCat(false);
  };

  // ── Drag ──────────────────────────────────────────────
  const handleDragStart = ({ active }: DragStartEvent) => {
    const d = active.data.current;
    if (d?.type === "task") {
      const all = [...data.not_started, ...data.in_progress, ...data.visible_completed];
      setActiveTask(all.find(t => t.id === d.taskId) ?? null);
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    if (!over) return;

    const activeData = active.data.current;
    const overId     = over.id.toString();

    if (activeData?.type === "task" && overId.startsWith("col:")) {
      const [, toCatId, toColRaw] = overId.split(":");
      const toCol = toColRaw as ColId;
      const { taskId, fromCatId, fromCol } = activeData as TaskDragData;

      const catChanged = toCatId !== fromCatId;
      const colChanged = toCol  !== fromCol;
      if (!catChanged && !colChanged) return;

      // If the dragged task is part of a multi-selection, move all selected tasks together
      if (selectedIds.has(taskId) && selectedIds.size > 1) {
        const batchUpdate: TaskUpdate = {
          name: null, description: null, priority: null,
          due_date: null, remove_due_date: null,
          recurrence: null, remove_recurrence: null,
          category_id: toCatId,
          state: colToState(toCol),
        };
        mutate(() => import("../api").then(m => m.api.updateTasks([...selectedIds], batchUpdate)));
      } else {
        const update: TaskUpdate = {
          name: null, description: null, priority: null,
          due_date: null, remove_due_date: null,
          recurrence: null, remove_recurrence: null,
          category_id: catChanged ? toCatId : null,
          state:       colChanged ? colToState(toCol) : null,
        };
        mutate(() => import("../api").then(m => m.api.updateTask(taskId, update)));
      }
    }

    if (activeData?.type === "cat" && overId.startsWith("cat:")) {
      const oldIdx = activeCategories.findIndex(c => `cat:${c.id}` === active.id.toString());
      const newIdx = activeCategories.findIndex(c => `cat:${c.id}` === overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reordered = arrayMove(activeCategories, oldIdx, newIdx);
        mutate(() => import("../api").then(m => m.api.reorderCategories(reordered.map(c => c.id))));
      }
    }
  };

  const ghostCat = activeTask
    ? data.categories.find(c => c.id === activeTask.category_id)
    : null;

  return (
    <div ref={outerRef} style={{ display: "flex", flexDirection: "row", height: "100%", position: "relative" }}>
      {/* Board — relative wrapper for dim overlay; inner div handles scroll + click-to-deselect */}
      <div ref={boardWrapRef} style={{ flex: 1, minWidth: 0, overflow: "hidden", position: "relative" }}>
        <div style={{ minHeight: "100%", height: scrollH ? `${scrollH}px` : "100%", overflowY: "auto", overflowX: "hidden" }} onClick={clearSelection}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div ref={boardHeaderRef} className="board-headers board-sticky">
            <div />
            <div className="col-header">Not Started</div>
            <div className="col-header">In Progress</div>
            <div className="col-header">Completed</div>
          </div>

          <div className="board-body">
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {activeCategories.map(cat => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  categories={data.categories}
                  groups={data.groups}
                  notStarted={data.not_started.filter(t => t.category_id === cat.id)}
                  inProgress={data.in_progress.filter(t => t.category_id === cat.id)}
                  visibleCompleted={data.visible_completed.filter(t => t.category_id === cat.id)}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectRange={handleSelectRange}
                  catSelected={selectedCatIds.has(cat.id)}
                  selectedCatIds={selectedCatIds}
                  onToggleCatSelect={handleToggleCatSelect}
                  onShiftSelectCat={handleSelectCatRange}
                  onOpenDetail={handleOpenDetail}
                  mode={mode}
                  mutate={mutate}
                />
              ))}
            </SortableContext>

            {/* "+" category slot */}
            <div className="category-row" style={{ marginTop: 4 }}>
              {addingCat ? (
                <div className="cat-add-active" style={{ gridColumn: "1 / -1" }} onMouseDown={e => e.preventDefault()}>
                  <input
                    autoFocus
                    className="add-ghost-input"
                    value={catName}
                    onChange={e => setCatName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleAddCategory();
                      if (e.key === "Escape") { setAddingCat(false); setCatName(""); }
                    }}
                    onBlur={() => { setAddingCat(false); setCatName(""); }}
                    placeholder="Category name…"
                  />
                </div>
              ) : (
                <>
                  <div className="cat-add-slot" onClick={() => setAddingCat(true)}>+</div>
                  <div /><div /><div />
                </>
              )}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask && ghostCat && (
              <div
                className={`task-card drag-ghost${activeTask.priority === "High" ? " task-card--high" : ""}`}
                style={{ border: `1.5px solid ${activeTask.priority === "High" ? ghostCat.display_color : "transparent"}` }}
              >
                <div className="task-card-name" style={{ color: ghostCat.display_color }}>
                  {activeTask.name}
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
        </div>
        {detailTask && !panelFullPage && (
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 5, cursor: "default" }}
            onClick={() => setDetailTask(null)}
          />
        )}
      </div>

      {/* Inline right panel — board to the left is dimmed when this is visible */}
      {detailTask && (
        <div style={
          panelFullPage
            ? { position: "absolute", inset: 0, zIndex: 10, width: "100%", height: "100%" }
            : { width: "45%", flexShrink: 0, height: "100%" }
        }>
          <TaskDetailPanel
            task={detailTask}
            isArchived={false}
            categories={data.categories}
            onClose={() => setDetailTask(null)}
            mutate={mutate}
            variant="inline"
          />
        </div>
      )}
    </div>
  );
}
