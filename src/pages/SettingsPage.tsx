import { useState } from "react";
import type { AppData, MutateFn, HideCompletedPolicy, Settings, AppMode } from "../types";

interface Props {
  data: AppData;
  mutate: MutateFn;
  mode: AppMode;
  onSetMode: (m: AppMode) => void;
}

type HideMode = "after" | "immediately";
type HideUnit = "Hours" | "Days";
type ClearMode = "never" | "after";

function parseHidePolicy(p: HideCompletedPolicy): { mode: HideMode; num: number; unit: HideUnit } {
  if (p === "Immediately") return { mode: "immediately", num: 1, unit: "Days" };
  if (typeof p === "object" && "AfterHours" in p) return { mode: "after", num: p.AfterHours.num_hours, unit: "Hours" };
  if (typeof p === "object" && "AfterDays"  in p) return { mode: "after", num: p.AfterDays.num_days,   unit: "Days" };
  // "Never" or unknown — default to After 1 Day
  return { mode: "after", num: 1, unit: "Days" };
}

function buildHidePolicy(mode: HideMode, num: number, unit: HideUnit): HideCompletedPolicy {
  if (mode === "immediately") return "Immediately";
  return unit === "Hours"
    ? { AfterHours: { num_hours: num } }
    : { AfterDays:  { num_days:  num } };
}

export function SettingsPage({ data, mutate, mode, onSetMode }: Props) {
  const init = parseHidePolicy(data.settings.hide_completed_delay);

  const [hideMode, setHideMode] = useState<HideMode>(init.mode);
  const [hideNum,  setHideNum]  = useState<number>(init.num);
  const [hideUnit, setHideUnit] = useState<HideUnit>(init.unit);
  const [clearMode, setClearMode] = useState<ClearMode>(
    data.settings.auto_clear_completed_days == null ? "never" : "after"
  );
  const [clearNum, setClearNum] = useState<number>(data.settings.auto_clear_completed_days ?? 90);

  const save = (patch: {
    hideMode?: HideMode; hideNum?: number; hideUnit?: HideUnit;
    clearMode?: ClearMode; clearNum?: number;
  }) => {
    const hm = patch.hideMode  ?? hideMode;
    const hn = patch.hideNum   ?? hideNum;
    const hu = patch.hideUnit  ?? hideUnit;
    const cm = patch.clearMode ?? clearMode;
    const cn = patch.clearNum  ?? clearNum;
    const settings: Settings = {
      hide_completed_delay:       buildHidePolicy(hm, hn, hu),
      auto_clear_completed_days:  cm === "never" ? null : cn,
    };
    mutate(() => import("../api").then(m => m.api.updateSettings(settings)));
  };

  const RadioDot = ({ on }: { on: boolean }) => (
    <div className={`radio-dot${on ? " radio-dot--on" : ""}`} />
  );

  return (
    <div className="page">
      <div className="page-title">Settings</div>

      {/* ── Simple Mode ─────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-head">Simple Mode</div>
        <div className="settings-field-label">
          Hide due dates and optional metadata from task cards.<br />
        </div>
        <button
          className={`toggle-btn${mode === "simple" ? " toggle-btn--on" : ""}`}
          onClick={() => onSetMode(mode === "simple" ? "default" : "simple")}
        >
          {mode === "simple" ? "ON" : "OFF"}
        </button>
      </div>

      <div className="settings-divider" />

      {/* ── General ─────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-head">General</div>
        <div className="settings-field-label">Hide completed tasks from the Main page</div>

        <div
          className={`radio-row${hideMode === "after" ? " radio-row--active" : ""}`}
          onClick={() => { setHideMode("after"); save({ hideMode: "after" }); }}
        >
          <RadioDot on={hideMode === "after"} />
          <label className="radio-label" onClick={e => e.preventDefault()}>
            After
            <input
              className="settings-num"
              type="number"
              min={1}
              value={hideNum}
              onClick={e => e.stopPropagation()}
              onChange={e => {
                const n = Math.max(1, parseInt(e.target.value) || 1);
                setHideNum(n);
                save({ hideMode: "after", hideNum: n });
              }}
            />
            <select
              className="settings-unit"
              value={hideUnit}
              onClick={e => e.stopPropagation()}
              onChange={e => {
                const u = e.target.value as HideUnit;
                setHideUnit(u);
                save({ hideMode: "after", hideUnit: u });
              }}
            >
              <option value="Hours">Hours</option>
              <option value="Days">Days</option>
            </select>
            {hideMode === "after" && (
              <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 4 }}>(Default)</span>
            )}
          </label>
        </div>

        <div
          className={`radio-row${hideMode === "immediately" ? " radio-row--active" : ""}`}
          onClick={() => { setHideMode("immediately"); save({ hideMode: "immediately" }); }}
        >
          <RadioDot on={hideMode === "immediately"} />
          <span className="radio-label">Immediately</span>
        </div>
      </div>

      <div className="settings-divider" />

      {/* ── Completed History ────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-head">Completed History</div>
        <div className="settings-field-label">Automatically clear completed history</div>

        <div
          className={`radio-row${clearMode === "never" ? " radio-row--active" : ""}`}
          onClick={() => { setClearMode("never"); save({ clearMode: "never" }); }}
        >
          <RadioDot on={clearMode === "never"} />
          <label className="radio-label" onClick={e => e.preventDefault()}>
            Never
            {clearMode === "never" && (
              <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 4 }}>(Default)</span>
            )}
          </label>
        </div>

        <div
          className={`radio-row${clearMode === "after" ? " radio-row--active" : ""}`}
          onClick={() => { setClearMode("after"); save({ clearMode: "after" }); }}
        >
          <RadioDot on={clearMode === "after"} />
          <label className="radio-label" onClick={e => e.preventDefault()}>
            After
            <input
              className="settings-num"
              type="number"
              min={1}
              value={clearNum}
              onClick={e => e.stopPropagation()}
              onChange={e => {
                const n = Math.max(1, parseInt(e.target.value) || 1);
                setClearNum(n);
                save({ clearMode: "after", clearNum: n });
              }}
            />
            <span style={{ color: "var(--text-muted)" }}>Days</span>
          </label>
        </div>
      </div>
    </div>
  );
}
