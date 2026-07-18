import { useState, useRef, useEffect } from "react";
import type { AppData, MutateFn, Category, Group, Task } from "../types";
import { ArchivedDetailPanel } from "../components/ArchivedDetailPanel";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Chevron, RestoreIcon, TrashIcon } from "../components/icons";
import { archivedISO, formatShortDate } from "../utils/taskUtils";

interface Props {
  data: AppData;
  mutate: MutateFn;
}

function groupItems<T extends { group_id?: string | null; order: number }>(
  items: T[],
  groups: Group[]
): { grouped: Map<string, T[]>; ungrouped: T[]; sortedGroups: Group[] } {
  const grouped = new Map<string, T[]>();
  const ungrouped: T[] = [];
  for (const item of items) {
    if (item.group_id) {
      const list = grouped.get(item.group_id) ?? [];
      list.push(item);
      grouped.set(item.group_id, list);
    } else {
      ungrouped.push(item);
    }
  }
  const sortedGroups = groups
    .filter(g => grouped.has(g.id))
    .sort((a, b) => {
      const aMin = Math.min(...(grouped.get(a.id) ?? []).map(i => i.order));
      const bMin = Math.min(...(grouped.get(b.id) ?? []).map(i => i.order));
      return aMin - bMin;
    });
  return { grouped, ungrouped, sortedGroups };
}

export function ArchivePage({ data, mutate }: Props) {
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set());
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [detailTask,   setDetailTask]   = useState<Task | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [contextMenu,  setContextMenu]  = useState<{ x: number; y: number; ids: string[] } | null>(null);

  const bubbleClickTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const outerRef = useRef<HTMLDivElement>(null);
  const [panelFullPage, setPanelFullPage] = useState(false);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setPanelFullPage(entry.contentRect.width <= 1300));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    return () => { bubbleClickTimers.current.forEach(t => clearTimeout(t)); };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  const toggle = (key: string) => setCollapsed(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  const catById = new Map(data.categories.map(c => [c.id, c]));

  const handleRestore = (ids: string[]) => {
    mutate(() => import("../api").then(m => m.api.updateArchivedTasks(ids, {
      state: "NotStarted",
      name: null, category_id: null, description: null,
      priority: null, due_date: null, remove_due_date: null,
      recurrence: null, remove_recurrence: null,
    })));
    setSelectedIds(new Set());
    if (detailTask && ids.includes(detailTask.id)) setDetailTask(null);
  };

  const handleDelete = (ids: string[]) => {
    setConfirmState({
      message: ids.length === 1
        ? `Delete "${data.archived.find(t => t.id === ids[0])?.name ?? ids[0]}"?`
        : `Delete ${ids.length} tasks?`,
      onConfirm: () => {
        setConfirmState(null);
        mutate(() => import("../api").then(m => m.api.deleteTasks(ids)));
        setSelectedIds(new Set());
        if (detailTask && ids.includes(detailTask.id)) setDetailTask(null);
      },
    });
  };

  const handleRestoreCat = (id: string) => {
    mutate(() => import("../api").then(m => m.api.unarchiveCategories([id])));
  };

  const handleDeleteCat = (id: string, name: string) => {
    setConfirmState({
      message: `Delete category "${name}" and all its tasks?`,
      onConfirm: () => {
        setConfirmState(null);
        mutate(() => import("../api").then(m => m.api.deleteCategories([id])));
      },
    });
  };

  // ── Archived tasks grouped by category ──────────────
  const archivedTasksByCat = new Map<string, Task[]>();
  for (const task of data.archived) {
    const list = archivedTasksByCat.get(task.category_id) ?? [];
    list.push(task);
    archivedTasksByCat.set(task.category_id, list);
  }

  const catsWithTasks = [...archivedTasksByCat.keys()]
    .map(id => catById.get(id))
    .filter((c): c is Category => c !== undefined)
    .sort((a, b) => a.order - b.order);

  const archivedCats = data.categories
    .filter(c => c.status === "Archived")
    .sort((a, b) => a.order - b.order);

  const taskCatResult     = groupItems(catsWithTasks, data.groups);
  const archivedCatResult = groupItems(archivedCats, data.groups);

  // ── Render helpers ───────────────────────────────────

  const renderTasksForCat = (cat: Category) => {
    const tasks = archivedTasksByCat.get(cat.id) ?? [];
    const key   = `tc:${cat.id}`;
    const isCollapsed = collapsed.has(key);
    const sorted = [...tasks].sort((a, b) => archivedISO(b).localeCompare(archivedISO(a)));

    return (
      <div key={cat.id} className={`completed-cat${cat.group_id ? " completed-cat--grouped" : ""}`}>
        <div
          className="completed-cat-head"
          style={cat.group_id ? {} : { color: cat.display_color, borderColor: cat.display_color }}
          onClick={() => toggle(key)}
        >
          <span>{cat.name}</span>
          <span className="comp-badge">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
          <span style={{ flex: 1 }} />
          <span className="collapse-caret"><Chevron open={!isCollapsed} size={20} /></span>
        </div>
        {!isCollapsed && (
          <div className="comp-bubble-grid">
            {sorted.map(task => (
              <div
                key={task.id}
                className={`comp-bubble${selectedIds.has(task.id) ? " comp-bubble--selected" : ""}${detailTask?.id === task.id ? " comp-bubble--active" : ""}`}
                onClick={e => {
                  if (e.ctrlKey || e.metaKey) {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      next.has(task.id) ? next.delete(task.id) : next.add(task.id);
                      return next;
                    });
                    return;
                  }
                  if (bubbleClickTimers.current.has(task.id)) {
                    clearTimeout(bubbleClickTimers.current.get(task.id)!);
                    bubbleClickTimers.current.delete(task.id);
                    setDetailTask(t => t?.id === task.id ? null : task);
                    setSelectedIds(new Set());
                  } else {
                    bubbleClickTimers.current.set(task.id, setTimeout(() => {
                      bubbleClickTimers.current.delete(task.id);
                      setSelectedIds(new Set([task.id]));
                    }, 220));
                  }
                }}
                onContextMenu={e => {
                  e.preventDefault();
                  const ids = selectedIds.has(task.id) && selectedIds.size > 1
                    ? [...selectedIds]
                    : [task.id];
                  setContextMenu({ x: e.clientX, y: e.clientY, ids });
                }}
              >
                <div>
                  <div className="comp-bubble-name">{task.name}</div>
                  <div className="comp-bubble-date">{formatShortDate(archivedISO(task))}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTaskGroup = (group: Group) => {
    const key   = `tg:${group.id}`;
    const isCollapsed = collapsed.has(key);
    const cats  = taskCatResult.grouped.get(group.id) ?? [];
    const totalCount = cats.reduce((s, c) => s + (archivedTasksByCat.get(c.id)?.length ?? 0), 0);

    return (
      <div key={group.id} className="group-section">
        <div
          className="group-head"
          style={{ color: group.color, borderColor: group.color }}
          onClick={() => toggle(key)}
        >
          <span>{group.name}</span>
          <span className="comp-badge">{totalCount} task{totalCount !== 1 ? "s" : ""}</span>
          <span style={{ flex: 1 }} />
          <span className="collapse-caret"><Chevron open={!isCollapsed} size={20} /></span>
        </div>
        {!isCollapsed && cats.map(cat => renderTasksForCat(cat))}
      </div>
    );
  };

  const renderArchivedCat = (cat: Category, inGroup: boolean) => {
    const taskCount = data.archived.filter(t => t.category_id === cat.id).length;
    return (
      <div key={cat.id} className="archive-row">
        <span
          className="cat-chip"
          style={!inGroup ? { background: cat.display_color, color: "#fff" } : { background: "var(--surface-hi)", color: "var(--text-muted)" }}
        >
          {cat.name}
        </span>
        <span style={{ flex: 1, fontSize: 12, color: "var(--text-muted)" }}>
          {taskCount} task{taskCount !== 1 ? "s" : ""}
        </span>
        <button className="btn btn-g" style={{ fontSize: 12 }} onClick={() => handleRestoreCat(cat.id)}>Restore</button>
        <button className="btn btn-d" style={{ fontSize: 12 }} onClick={() => handleDeleteCat(cat.id, cat.name)}>Delete</button>
      </div>
    );
  };

  const renderArchivedCatGroup = (group: Group) => {
    const key = `cg:${group.id}`;
    const isCollapsed = collapsed.has(key);
    const cats = archivedCatResult.grouped.get(group.id) ?? [];
    return (
      <div key={group.id} className="group-section">
        <div
          className="group-head"
          style={{ color: group.color, borderColor: group.color }}
          onClick={() => toggle(key)}
        >
          <span>{group.name}</span>
          <span style={{ flex: 1 }} />
          <span className="collapse-caret"><Chevron open={!isCollapsed} size={20} /></span>
        </div>
        {!isCollapsed && cats.map(cat => renderArchivedCat(cat, true))}
      </div>
    );
  };

  const panelStyle = panelFullPage
    ? { position: "absolute" as const, inset: 0, zIndex: 10, width: "100%", height: "100%" }
    : { width: "45%", flexShrink: 0 as const, height: "100%" };

  return (
    <div ref={outerRef} style={{ display: "flex", flexDirection: "row", height: "100%", overflow: "hidden", position: "relative" }}>
      {/* Left: scrollable archive list */}
      <div style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
        <div style={{ height: "100%", overflowY: "auto", padding: "18px 22px" }}>
          <div className="page-title">Archive</div>

          {/* ── Archived tasks ─────────────────────────── */}
          <div className="section-head">Tasks</div>
          {data.archived.length === 0 ? (
            <p className="empty">No archived tasks.</p>
          ) : (
            <>
              {taskCatResult.sortedGroups.map(renderTaskGroup)}
              {taskCatResult.ungrouped.map(cat => renderTasksForCat(cat))}
            </>
          )}

          {/* ── Archived categories ──────────────────── */}
          <div style={{ marginTop: 60 }}>
          <div className="section-head">Categories</div>
          {archivedCats.length === 0 ? (
            <p className="empty">No archived categories.</p>
          ) : (
            <>
              {archivedCatResult.sortedGroups.map(renderArchivedCatGroup)}
              {archivedCatResult.ungrouped.map(cat => renderArchivedCat(cat, false))}
            </>
          )}
          </div>
        </div>

        {detailTask && !panelFullPage && (
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 5, cursor: "default" }}
            onClick={() => setDetailTask(null)}
          />
        )}
      </div>

      {/* Right: detail panel */}
      {detailTask && (
        <div style={panelStyle}>
          <ArchivedDetailPanel
            task={detailTask}
            onClose={() => setDetailTask(null)}
            mutate={mutate}
          />
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="ctx-menu"
          style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="ctx-menu-item ctx-menu-item--restore"
            onClick={() => { handleRestore(contextMenu.ids); setContextMenu(null); }}
          >
            <RestoreIcon />
            Restore{contextMenu.ids.length > 1 ? ` (${contextMenu.ids.length})` : ""}
          </button>
          <button
            className="ctx-menu-item ctx-menu-item--delete"
            onClick={() => { handleDelete(contextMenu.ids); setContextMenu(null); }}
          >
            <TrashIcon />
            Delete{contextMenu.ids.length > 1 ? ` (${contextMenu.ids.length})` : ""}
          </button>
        </div>
      )}

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
