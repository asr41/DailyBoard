import { useState, useEffect, useRef } from "react";
import type { Task, TaskUpdate, MutateFn } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { api } from "../api";
import { CalendarIcon, ClockIcon, TrashIcon, ArchiveIcon, PanelToggle, Chevron, FlameIcon } from "./icons";
import { toEditorHtml, lastCompletedISO } from "../utils/taskUtils";
import { RichTextEditor, type EditorHandle } from "./RichTextEditor";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function TrophyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}

interface Props {
  task: Task;
  onClose: () => void;
  mutate: MutateFn;
}

export function CompletedDetailPanel({ task, onClose, mutate }: Props) {
  const [name,          setName]         = useState(task.name);
  const [desc,          setDesc]         = useState(task.description);
  const [inspCollapsed, setInspCollapsed] = useState(false);
  const [calExpanded,   setCalExpanded]  = useState(true);
  const [confirmState,  setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const initISO = lastCompletedISO(task);
  const initDate = initISO ? new Date(initISO) : new Date();
  const [calYear,  setCalYear]  = useState(initDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initDate.getMonth());

  const editorRef = useRef<EditorHandle>(null);

  useEffect(() => {
    setName(task.name);
    setDesc(task.description);
    const iso = lastCompletedISO(task);
    const d = iso ? new Date(iso) : new Date();
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setCalExpanded(true);
    editorRef.current?.setHTML(task.description ? toEditorHtml(task.description) : "");
  }, [task.id]);

  const handleSave = () => {
    const richDesc = editorRef.current?.getHTML() ?? desc;
    const update: TaskUpdate = {
      name:              name !== task.name ? name : null,
      description:       richDesc !== task.description ? richDesc : null,
      category_id:       null, priority: null,
      due_date:          null, remove_due_date: null,
      recurrence:        null, remove_recurrence: null,
      state:             null,
    };
    mutate(() => api.updateTask(task.id, update));
    onClose();
  };

  const handleArchive = () => {
    const NOW = new Date().toISOString();
    mutate(() => api.updateTask(task.id, {
      state: { Archived: { archived_date: NOW } },
      name: null, category_id: null, description: null,
      priority: null, due_date: null, remove_due_date: null,
      recurrence: null, remove_recurrence: null,
    }));
    onClose();
  };

  const handleDelete = () => {
    setConfirmState({
      message: `Delete "${task.name}"?`,
      onConfirm: () => {
        setConfirmState(null);
        mutate(() => api.deleteTasks([task.id]));
        onClose();
      },
    });
  };

  // Calendar
  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const completedDays = new Set(task.completed_history.map(iso => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));

  const firstWeekday = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const completedISO = lastCompletedISO(task);
  const completedDateStr = completedISO
    ? new Date(completedISO).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const completedTimeStr = completedISO
    ? new Date(completedISO).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "—";

  return (
    <>
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
      <div className="panel-bottom">

        {/* ── Header ────────────────────────────────────── */}
        <div className="panel-bottom-head">
          <div className={`panel-head-left${inspCollapsed ? " panel-head-left--collapsed" : ""}`}>
            <button className="insp-back" onClick={() => setInspCollapsed(p => !p)}
              title={inspCollapsed ? "Expand inspector" : "Collapse inspector"}>
              <PanelToggle collapsed={inspCollapsed} />
            </button>
          </div>
          <div className="panel-head-right">
            <input
              className="content-title-input"
              maxLength={40}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Task name"
            />
            <button className="btn btn-p" onClick={handleSave}>Save</button>
            <button className="insp-close" onClick={onClose} title="Close">×</button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────── */}
        <div className="panel-bottom-body">

          {/* ── Inspector (left) ──────────────────────── */}
          <div className={`insp-col${inspCollapsed ? " insp-col--hidden" : ""}`}>

            {/* COMPLETED DATE */}
            <div className="insp-block">
              <div className="insp-block-label">Completed</div>
              <div className="insp-display-row">
                <CalendarIcon />
                <span>{completedDateStr}</span>
              </div>
              <div className="insp-display-row">
                <ClockIcon />
                <span>{completedTimeStr}</span>
              </div>
            </div>

            {/* STREAK STATS — only for recurring tasks */}
            {task.recurrence && (
              <div className="insp-block">
                <div className="comp-stat-row">
                  <div className="comp-stat-label">Current Streak</div>
                  <div className="comp-stat-value">
                    <FlameIcon width={28} height={34} fill="var(--purple)" style={{ flexShrink: 0 }} />
                    <span className="comp-stat-num">{task.recurrence.streak}</span>
                    <span className="comp-stat-unit">days</span>
                  </div>
                </div>
                <div className="comp-stat-row">
                  <div className="comp-stat-label">Longest Streak</div>
                  <div className="comp-stat-value">
                    <TrophyIcon />
                    <span className="comp-stat-num">{task.recurrence.longest_streak}</span>
                    <span className="comp-stat-unit">days</span>
                  </div>
                </div>
                <div className="comp-stat-row">
                  <div className="comp-stat-label">Completions</div>
                  <div className="comp-stat-value">
                    <CheckCircleIcon />
                    <span className="comp-stat-num">{task.completed_history.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* COMPLETION HISTORY — inline calendar */}
            {task.completed_history.length > 0 && (
              <div className="insp-section">
                <div className="insp-section-hd" onClick={() => setCalExpanded(p => !p)}>
                  <span className="insp-section-title">Completion History</span>
                  <div className="insp-section-right">
                    <span className="collapse-caret"><Chevron open={calExpanded} /></span>
                  </div>
                </div>
                {calExpanded && (
                  <div className="insp-section-body">
                    <div className="comp-cal-nav">
                      <button className="comp-cal-nav-btn" onClick={prevMonth}>‹</button>
                      <span className="comp-cal-month">{MONTHS[calMonth]} {calYear}</span>
                      <button className="comp-cal-nav-btn" onClick={nextMonth}>›</button>
                    </div>
                    <div className="comp-cal-grid">
                      {["S","M","T","W","T","F","S"].map((d, i) => (
                        <div key={i} className="comp-cal-dow">{d}</div>
                      ))}
                      {cells.map((day, i) => {
                        if (!day) return <div key={i} />;
                        const key = `${calYear}-${calMonth}-${day}`;
                        return (
                          <div key={i} className={`comp-cal-day${completedDays.has(key) ? " comp-cal-day--done" : ""}`}>
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Archive / Delete */}
            <div className="insp-actions">
              <button className="insp-action-btn insp-action-btn--archive" onClick={handleArchive}>
                <ArchiveIcon />
                Archive
              </button>
              <button className="insp-action-btn insp-action-btn--delete" onClick={handleDelete}>
                <TrashIcon />
                Delete
              </button>
            </div>
          </div>

          {/* ── Content (right) ───────────────────────── */}
          <div className="content-col">
            <div className="content-desc-label">Description</div>
            <div className="panel-desc-body">
              <RichTextEditor ref={editorRef} onBlurChange={html => setDesc(html)} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
