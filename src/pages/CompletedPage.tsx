import { useState, useRef, useEffect } from "react";
import type { AppData, Task, Category, Group, MutateFn, AppMode } from "../types";
import { CompletedDetailPanel } from "../components/CompletedDetailPanel";
import { Chevron } from "../components/icons";
import { lastCompletedISO, formatShortDate } from "../utils/taskUtils";

interface Props {
  data: AppData;
  mode: AppMode;
  mutate: MutateFn;
}

function BubbleCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}

export function CompletedPage({ data, mode: _mode, mutate }: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedCats,   setCollapsedCats]   = useState<Set<string>>(new Set());
  const [detailTask,      setDetailTask]      = useState<Task | null>(null);
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());

  const bubbleClickTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const outerRef = useRef<HTMLDivElement>(null);
  const [panelFullPage, setPanelFullPage] = useState(false);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setPanelFullPage(entry.contentRect.width <= 1300);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      bubbleClickTimers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const toggleGroup = (id: string) => setCollapsedGroups(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleCat = (id: string) => setCollapsedCats(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleBubbleClick = (e: React.MouseEvent, task: Task) => {
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
  };

  const byCategory = new Map<string, Task[]>();
  for (const task of data.completed) {
    const list = byCategory.get(task.category_id) ?? [];
    list.push(task);
    byCategory.set(task.category_id, list);
  }

  const activeCats = data.categories
    .filter(c => c.status === "Active" && (byCategory.get(c.id)?.length ?? 0) > 0)
    .sort((a, b) => a.order - b.order);

  const groupMap = new Map<string, Category[]>();
  const ungrouped: Category[] = [];
  for (const cat of activeCats) {
    if (cat.group_id) {
      const list = groupMap.get(cat.group_id) ?? [];
      list.push(cat);
      groupMap.set(cat.group_id, list);
    } else {
      ungrouped.push(cat);
    }
  }

  const sortedGroups: Group[] = data.groups
    .filter(g => groupMap.has(g.id))
    .sort((a, b) => {
      const aMin = Math.min(...(groupMap.get(a.id) ?? []).map(c => c.order));
      const bMin = Math.min(...(groupMap.get(b.id) ?? []).map(c => c.order));
      return aMin - bMin;
    });

  const renderCatBlock = (cat: Category) => {
    const tasks = byCategory.get(cat.id) ?? [];
    if (tasks.length === 0) return null;
    const isCollapsed = collapsedCats.has(cat.id);

    const sorted = [...tasks].sort((a, b) =>
      lastCompletedISO(b).localeCompare(lastCompletedISO(a))
    );

    return (
      <div key={cat.id} className={`completed-cat${cat.group_id ? " completed-cat--grouped" : ""}`}>
        <div
          className="completed-cat-head"
          style={cat.group_id ? {} : { color: cat.display_color, borderColor: cat.display_color }}
          onClick={() => toggleCat(cat.id)}
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
                onClick={e => handleBubbleClick(e, task)}
              >
                <BubbleCheck />
                <div>
                  <div className="comp-bubble-name">{task.name}</div>
                  <div className="comp-bubble-date">{formatShortDate(lastCompletedISO(task))}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const listContent = activeCats.length === 0 ? (
    <p className="empty">No completed tasks yet.</p>
  ) : (
    <>
      {sortedGroups.map(group => {
        const groupCats  = groupMap.get(group.id) ?? [];
        const totalCount = groupCats.reduce((sum, c) => sum + (byCategory.get(c.id)?.length ?? 0), 0);
        const isCollapsed = collapsedGroups.has(group.id);
        return (
          <div key={group.id} className="group-section">
            <div
              className="group-head"
              style={{ color: group.color, borderColor: group.color }}
              onClick={() => toggleGroup(group.id)}
            >
              <span>{group.name}</span>
              <span className="comp-badge">{totalCount} task{totalCount !== 1 ? "s" : ""}</span>
              <span style={{ flex: 1 }} />
              <span className="collapse-caret"><Chevron open={!isCollapsed} size={20} /></span>
            </div>
            {!isCollapsed && groupCats.map(cat => renderCatBlock(cat))}
          </div>
        );
      })}
      {ungrouped.map(cat => renderCatBlock(cat))}
    </>
  );

  const panelStyle = panelFullPage
    ? { position: "absolute" as const, inset: 0, zIndex: 10, width: "100%", height: "100%" }
    : { width: "45%", flexShrink: 0 as const, height: "100%" };

  return (
    <div ref={outerRef} style={{ display: "flex", flexDirection: "row", height: "100%", overflow: "hidden", position: "relative" }}>
      {/* Left: scrollable task list */}
      <div style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
        <div style={{ height: "100%", overflowY: "auto", padding: "18px 22px" }}>
          <div className="page-title">Completed</div>
          {listContent}
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
          <CompletedDetailPanel
            task={detailTask}
            onClose={() => setDetailTask(null)}
            mutate={mutate}
          />
        </div>
      )}
    </div>
  );
}
