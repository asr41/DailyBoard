import { useState, useEffect, useCallback } from "react";
import { api } from "./api";
import type { AppData, MutateFn, AppMode } from "./types";
import { Sidebar } from "./components/Sidebar";
import { MainPage } from "./pages/MainPage";
import { CompletedPage } from "./pages/CompletedPage";
import { ArchivePage } from "./pages/ArchivePage";
import { SettingsPage } from "./pages/SettingsPage";

export type Page = "main" | "completed" | "archive" | "settings";

export default function App() {
  const [page,          setPage]          = useState<Page>("main");
  const [data,          setData]          = useState<AppData | null>(null);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [mode, setMode] = useState<AppMode>(() => {
    const s = localStorage.getItem("viewMode");
    return (s === "simple" || s === "default") ? s : "default";
  });

  const setViewMode = useCallback((m: AppMode) => {
    setMode(m);
    localStorage.setItem("viewMode", m);
  }, []);

  const loadData = useCallback(async () => {
    const fresh = await api.getAllData();
    setData(fresh);
  }, []);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Periodic refresh — runs recurring task resets, due-date promotions, auto-clear
  useEffect(() => {
    const id = setInterval(async () => {
      try { setData(await api.refresh()); }
      catch (e) { console.error("Periodic refresh failed:", e); }
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // All write commands go through here: run action → re-sync from Rust
  const mutate: MutateFn = useCallback(async (action) => {
    try {
      await action();
      await loadData();
    } catch (e) {
      console.error("Command failed:", e);
    }
  }, [loadData]);

  if (!data) return <div className="screen-center">Loading…</div>;

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={setPage} collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
      <main className="app-content">
        {page === "main"      && <MainPage      data={data} mutate={mutate} mode={mode} />}
        {page === "completed" && <CompletedPage data={data} mutate={mutate} />}
        {page === "archive"   && <ArchivePage   data={data} mutate={mutate} />}
        {page === "settings"  && <SettingsPage  data={data} mutate={mutate} mode={mode} onSetMode={setViewMode} onRefreshData={loadData} />}
      </main>
    </div>
  );
}
