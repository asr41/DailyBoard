import { useState, useEffect, useRef } from "react";
import type { Task, TaskUpdate, Priority, RecurrenceUnit, MutateFn } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { DatePicker } from "./DatePicker";
import { api } from "../api";
import { CalendarIcon, ClockIcon, TrashIcon, ArchiveIcon, PanelToggle, Chevron, FlameIcon } from "./icons";
import { toEditorHtml } from "../utils/taskUtils";
import { RichTextEditor, type EditorHandle } from "./RichTextEditor";

const UNITS: RecurrenceUnit[] = ["Hours", "Days", "Weeks", "Months", "Years"];

function toLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalTime(iso: string | null | undefined): string {
  if (!iso) return "00:00";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toUTC(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function dueSummary(date: string, time: string): string {
  if (!date) return "";
  const d = new Date(`${date}T${time}:00`);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

function recSummary(interval: number, unit: RecurrenceUnit): string {
  const singular = unit.toLowerCase().replace(/s$/, "");
  return `Every ${interval} ${singular}${interval !== 1 ? "s" : ""}`;
}

interface Props {
  task: Task;
  isArchived: boolean;
  onClose: () => void;
  mutate: MutateFn;
}

export function TaskDetailPanel({
  task, isArchived, onClose, mutate,
}: Props) {
  const [name,          setName]         = useState(task.name);
  const [desc,          setDesc]         = useState(task.description);
  const [priority,      setPriority]     = useState<Priority>(task.priority);

  const [dueDate,       setDueDate]      = useState(toLocalDate(task.due_date));
  const [dueTime,       setDueTime]      = useState(toLocalTime(task.due_date));
  const [dueExpanded,   setDueExpanded]  = useState(false);

  const [recEnabled,    setRecEnabled]   = useState(task.recurrence !== null);
  const [recInterval,   setRecInterval]  = useState(task.recurrence?.interval ?? 1);
  const [recUnit,       setRecUnit]      = useState<RecurrenceUnit>(task.recurrence?.unit ?? "Days");
  const [recStart,      setRecStart]     = useState(toLocalDate(task.recurrence?.cycle_start));
  const [recStartTime,  setRecStartTime] = useState(toLocalTime(task.recurrence?.cycle_start));
  const [recExpanded,   setRecExpanded]  = useState(false);
  const [clearRec,      setClearRec]     = useState(false);

  const [inspCollapsed, setInspCollapsed] = useState(false);
  const [confirmState,  setConfirmState]  = useState<{ message: string; onConfirm: () => void } | null>(null);

  const editorRef = useRef<EditorHandle>(null);

  const dueSet = dueDate !== "";

  useEffect(() => {
    setName(task.name);
    setDesc(task.description);
    setPriority(task.priority);
    setDueDate(toLocalDate(task.due_date));
    setDueTime(toLocalTime(task.due_date));
    setDueExpanded(false);
    setRecEnabled(task.recurrence !== null);
    setRecInterval(task.recurrence?.interval ?? 1);
    setRecUnit(task.recurrence?.unit ?? "Days");
    setRecStart(toLocalDate(task.recurrence?.cycle_start));
    setRecStartTime(toLocalTime(task.recurrence?.cycle_start));
    setRecExpanded(false);
    setClearRec(false);
    editorRef.current?.setHTML(task.description ? toEditorHtml(task.description) : "");
  }, [task.id]);

  const handleSave = () => {
    const richDesc = editorRef.current?.getHTML() ?? desc;

    const initDate    = toLocalDate(task.due_date);
    const initTime    = toLocalTime(task.due_date);
    const initStart   = toLocalDate(task.recurrence?.cycle_start);
    const initStartTm = toLocalTime(task.recurrence?.cycle_start);

    const dueChanged = dueSet && (dueDate !== initDate || dueTime !== initTime);
    const recChanged = recEnabled && (
      recInterval   !== (task.recurrence?.interval ?? 1) ||
      recUnit       !== (task.recurrence?.unit     ?? "Days") ||
      recStart      !== initStart ||
      recStartTime  !== initStartTm ||
      task.recurrence === null
    );

    const update: TaskUpdate = {
      name:              name !== task.name ? name : null,
      description:       richDesc !== task.description ? richDesc : null,
      category_id:       null,
      priority:          priority !== task.priority ? priority : null,
      due_date:          dueChanged ? toUTC(dueDate, dueTime) : null,
      remove_due_date:   (!dueSet && task.due_date !== null) ? true : null,
      recurrence:        !clearRec && recEnabled && recChanged
                           ? { interval: recInterval, unit: recUnit,
                               start_date: recStart ? toUTC(recStart, recStartTime) : null }
                           : null,
      remove_recurrence: (clearRec || (!recEnabled && task.recurrence !== null)) ? true : null,
      state:             null,
    };

    mutate(() => isArchived ? api.updateArchivedTask(task.id, update) : api.updateTask(task.id, update));
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

  const handleArchive = () => {
    const NOW = new Date().toISOString();
    mutate(() =>
      isArchived
        ? api.updateArchivedTask(task.id, {
            state: "NotStarted", name: null, category_id: null, description: null,
            priority: null, due_date: null, remove_due_date: null, recurrence: null, remove_recurrence: null,
          })
        : api.updateTask(task.id, {
            state: { Archived: { archived_date: NOW } }, name: null, category_id: null, description: null,
            priority: null, due_date: null, remove_due_date: null, recurrence: null, remove_recurrence: null,
          })
    );
    onClose();
  };

  const removeDue = () => { setDueDate(""); setDueTime("09:00"); setDueExpanded(false); };

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
            <button className="insp-back" onClick={() => setInspCollapsed(p => !p)} title={inspCollapsed ? "Expand inspector" : "Collapse inspector"}>
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

            {/* Priority */}
            <div className="insp-block">
              <div className="insp-block-label">Priority</div>
              <div className="insp-seg">
                <button
                  className={`insp-seg-btn${priority === "Normal" ? " insp-seg-btn--on" : ""}`}
                  onClick={() => setPriority("Normal")}
                >Normal</button>
                <button
                  className={`insp-seg-btn${priority === "High" ? " insp-seg-btn--on" : ""}`}
                  onClick={() => setPriority("High")}
                >High</button>
              </div>
            </div>

            {/* Due Date */}
            <div className="insp-section">
              <div className="insp-section-hd" onClick={() => setDueExpanded(p => !p)}>
                <span className="insp-section-title">Due Date</span>
                <div className="insp-section-right">
                  {!dueExpanded && (
                    <span className="insp-section-summary">
                      {dueSet ? dueSummary(dueDate, dueTime) : "None"}
                    </span>
                  )}
                  <span className="collapse-caret"><Chevron open={dueExpanded} /></span>
                </div>
              </div>
              {dueExpanded && (
                <div className="insp-section-body">
                  <div>
                    <div className="insp-field-label">Date</div>
                    <div className="insp-val-row">
                      <CalendarIcon />
                      <DatePicker
                        value={dueDate}
                        onChange={setDueDate}
                        placeholder="Pick a date"
                      />
                      {dueSet && (
                        <button className="insp-val-clear" onClick={e => { e.stopPropagation(); removeDue(); }}>×</button>
                      )}
                    </div>
                  </div>
                  {dueSet && (
                    <div>
                      <div className="insp-field-label">Time</div>
                      <div className="insp-val-row">
                        <ClockIcon />
                        <input
                          type="time"
                          className="insp-time-input"
                          value={dueTime}
                          onChange={e => setDueTime(e.target.value)}
                        />
                        <button className="insp-val-clear" onClick={() => setDueTime("09:00")}>×</button>
                      </div>
                    </div>
                  )}
                  {dueSet && (
                    <button className="insp-remove" onClick={removeDue}>
                      <span>×</span> Remove Due Date
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Recurrence */}
            <div className="insp-section">
              <div className="insp-section-hd" onClick={() => {
                if (!recEnabled) { setRecEnabled(true); setRecExpanded(true); }
                else setRecExpanded(p => !p);
              }}>
                <span className="insp-section-title">Recurrence</span>
                <div className="insp-section-right">
                  {!recExpanded && (
                    <span className="insp-section-summary">
                      {recEnabled
                        ? `${recSummary(recInterval, recUnit)}${task.recurrence?.streak ? ` · 🔥${task.recurrence.streak}` : ""}`
                        : "None"}
                    </span>
                  )}
                  <span className="collapse-caret"><Chevron open={recExpanded} /></span>
                </div>
              </div>
              {recExpanded && (
                <div className="insp-section-body">
                  {clearRec ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cleared on save</span>
                      <button className="btn btn-g" style={{ fontSize: 11 }}
                        onClick={() => { setClearRec(false); setRecEnabled(task.recurrence !== null); }}>
                        Undo
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="insp-field-label">Every</div>
                        <div className="insp-interval-row">
                          <input
                            type="number"
                            min={1}
                            className="insp-interval-num"
                            value={recInterval}
                            onChange={e => setRecInterval(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                          <select
                            className="insp-unit-select"
                            value={recUnit}
                            onChange={e => setRecUnit(e.target.value as RecurrenceUnit)}
                          >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <div className="insp-field-label">Starts</div>
                        <div className="insp-val-row">
                          <CalendarIcon />
                          <DatePicker
                            value={recStart}
                            onChange={setRecStart}
                            placeholder="No start date"
                          />
                          {recStart && (
                            <button className="insp-val-clear" onClick={e => { e.stopPropagation(); setRecStart(""); }}>×</button>
                          )}
                        </div>
                      </div>
                      {recStart && (
                        <div>
                          <div className="insp-field-label">Start Time</div>
                          <div className="insp-val-row">
                            <ClockIcon />
                            <input
                              type="time"
                              className="insp-time-input"
                              value={recStartTime}
                              onChange={e => setRecStartTime(e.target.value)}
                            />
                            <button className="insp-val-clear" onClick={() => setRecStartTime("00:00")}>×</button>
                          </div>
                        </div>
                      )}
                      {task.recurrence && (
                        <div className="insp-streak">
                          <FlameIcon width={13} height={17} fill="var(--accent)" />
                          <span>{task.recurrence.streak} streak</span>
                        </div>
                      )}
                      <button
                        className="insp-remove"
                        onClick={() => {
                          if (task.recurrence) setClearRec(true);
                          setRecEnabled(false);
                          setRecExpanded(false);
                        }}
                      >
                        <span>×</span> Remove Recurrence
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Archive / Delete */}
            <div className="insp-actions">
              <button className="insp-action-btn insp-action-btn--archive" onClick={handleArchive}>
                <ArchiveIcon />
                {isArchived ? "Restore" : "Archive"}
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
