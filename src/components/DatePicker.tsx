import { useState } from "react";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface Props {
  value: string;        // "YYYY-MM-DD" or ""
  onChange: (v: string) => void;
  placeholder?: string;
}

export function DatePicker({ value, onChange, placeholder = "Pick a date" }: Props) {
  const today = new Date();
  const init = value ? new Date(value + "T00:00:00") : today;

  const [open, setOpen]           = useState(false);
  const [viewYear, setViewYear]   = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());

  const label = value
    ? new Date(value + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : placeholder;

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const selectedKey = value
    ? (() => { const d = new Date(value + "T00:00:00"); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; })()
    : "";

  const prev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const next = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const pickDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  };

  return (
    <div className="dp-wrap">
      <button
        className={`dp-trigger${!value ? " dp-trigger--empty" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        {label}
      </button>
      {open && (
        <>
          <div className="dp-backdrop" onMouseDown={() => setOpen(false)} />
          <div className="dp-popup" onPointerDown={e => e.stopPropagation()}>
            <div className="dp-nav">
              <button className="dp-nav-btn" onClick={prev}>‹</button>
              <span className="dp-month">{MONTHS[viewMonth]} {viewYear}</span>
              <button className="dp-nav-btn" onClick={next}>›</button>
            </div>
            <div className="dp-grid">
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <div key={i} className="dp-dow">{d}</div>
              ))}
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const key = `${viewYear}-${viewMonth}-${day}`;
                const isSel   = key === selectedKey;
                const isToday = key === todayKey;
                return (
                  <button
                    key={i}
                    className={`dp-day${isSel ? " dp-day--selected" : ""}${isToday && !isSel ? " dp-day--today" : ""}`}
                    onClick={() => pickDay(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
