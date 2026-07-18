import { useState, useEffect, useRef } from "react";
import type { Task, TaskUpdate, MutateFn } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { api } from "../api";
import { CalendarIcon, ClockIcon, RestoreIcon, TrashIcon, PanelToggle } from "./icons";
import { toEditorHtml, archivedISO } from "../utils/taskUtils";
import { RichTextEditor, type EditorHandle } from "./RichTextEditor";

interface Props {
  task: Task;
  onClose: () => void;
  mutate: MutateFn;
}

export function ArchivedDetailPanel({ task, onClose, mutate }: Props) {
  const [name,          setName]          = useState(task.name);
  const [desc,          setDesc]          = useState(task.description);
  const [inspCollapsed, setInspCollapsed] = useState(false);
  const [confirmState,  setConfirmState]  = useState<{ message: string; onConfirm: () => void } | null>(null);

  const editorRef = useRef<EditorHandle>(null);

  useEffect(() => {
    setName(task.name);
    setDesc(task.description);
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
    mutate(() => api.updateArchivedTask(task.id, update));
    onClose();
  };

  const handleRestore = () => {
    mutate(() => api.updateArchivedTask(task.id, {
      state: "NotStarted",
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

  const iso = archivedISO(task);
  const archivedDateStr = iso
    ? new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const archivedTimeStr = iso
    ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
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

            {/* ARCHIVED DATE */}
            <div className="insp-block">
              <div className="insp-block-label">Archived</div>
              <div className="insp-display-row">
                <CalendarIcon />
                <span>{archivedDateStr}</span>
              </div>
              <div className="insp-display-row">
                <ClockIcon />
                <span>{archivedTimeStr}</span>
              </div>
            </div>

            {/* Restore / Delete */}
            <div className="insp-actions">
              <button className="insp-action-btn insp-action-btn--restore" onClick={handleRestore}>
                <RestoreIcon />
                Restore
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
