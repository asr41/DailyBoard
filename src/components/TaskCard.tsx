import { useState, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task, AppMode } from "../types";

export type ColType = "not_started" | "in_progress" | "completed";

interface TaskCardProps {
  task: Task;
  col: ColType;
  color: string;
  selected: boolean;
  mode: AppMode;
  onToggleSelect: (id: string, multi: boolean) => void;
  onShiftSelect: (id: string) => void;
  onToggleComplete: () => void;
  onOpenDetail: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function TaskCard({
  task, col, color, selected, mode,
  onToggleSelect, onShiftSelect, onToggleComplete, onOpenDetail,
  onArchive, onDelete,
}: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isHigh = task.priority === "High";
  const isCompleted = col === "completed";
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
    };
  }, []);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { type: "task", taskId: task.id, fromCatId: task.category_id, fromCol: col },
  });

  const dragStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
    touchAction: "none",
  };

  const colorStyle: React.CSSProperties = isHigh
    ? { border: `1.5px solid ${color}` }
    : {};

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) { onShiftSelect(task.id); return; }
    if (e.ctrlKey || e.metaKey) { onToggleSelect(task.id, true); return; }
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onOpenDetail();
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        onToggleSelect(task.id, false);
      }, 220);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(true);
  };

  const close = () => setMenuOpen(false);

  return (
    <div
      ref={setNodeRef}
      style={{ ...dragStyle, ...colorStyle, ...(menuOpen ? { filter: "none", transition: "none" } : {}) }}
      className={`task-card${selected ? " task-card--selected" : ""}${isHigh ? " task-card--high" : ""}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      {...listeners}
      {...attributes}
    >
      <div className="task-card-top">
        {mode !== "simple" && (
          <div
            className={`task-checkbox${isCompleted ? " task-checkbox--checked" : ""}`}
            style={{
              borderColor: color,
              background: isCompleted ? color : "transparent",
            }}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onToggleComplete(); }}
          >
            {isCompleted && (
              <svg width="11" height="8" viewBox="0 0 10 8" fill="none" stroke="var(--bg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 3.5 6.5 9 1"/>
              </svg>
            )}
          </div>
        )}
        <div className="task-card-name" style={{ color }} title={task.name}>
          {task.name}
        </div>
        {task.due_date && mode !== "simple" && (
          <span className="task-card-due">
            Due {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      {menuOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 299 }}
            onMouseDown={close}
            onClick={e => e.stopPropagation()}
          />
          <div className="task-menu" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <button className="task-menu-item" onClick={() => { onArchive(); close(); }}>Archive</button>
            <button className="task-menu-item task-menu-item--danger" onClick={() => { onDelete(); close(); }}>Delete</button>
          </div>
        </>
      )}
    </div>
  );
}
