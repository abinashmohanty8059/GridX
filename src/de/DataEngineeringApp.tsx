import { useEffect } from 'react';
import {
  BookOpen, Moon, Redo2, Repeat, Sun, Table2, Undo2, UploadCloud, Waypoints,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAppMode } from '../context/AppModeContext';
import logoImg from '../assets/square-image.jpg';
import { DEProvider, DEView, useDE } from './store';
import ErrorBoundary from '../components/ErrorBoundary';
import { LAYERS } from './types';
import SetupView from './views/SetupView';
import CanvasView from './views/CanvasView';
import CatalogView from './views/CatalogView';
import InsightsView from './views/InsightsView';

const NAV: { id: DEView; label: string; icon: typeof Table2; color: string }[] = [
  { id: 'setup', label: 'Pipeline Setup', icon: UploadCloud, color: 'text-sky-400' },
  { id: 'canvas', label: 'Schema Canvas', icon: Waypoints, color: 'text-violet-400' },
  { id: 'catalog', label: 'Data Catalog', icon: Table2, color: 'text-emerald-400' },
  { id: 'insights', label: 'Insights & Guide', icon: BookOpen, color: 'text-amber-400' },
];

function DESidebar() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { switchMode } = useAppMode();
  const { view, setView, ws, graph, undo, redo, canUndo, canRedo } = useDE();

  return (
    <div className="w-60 h-screen bg-[#0D1B2A] flex flex-col py-6 border-r border-[#1e3450] shrink-0 text-white shadow-xl z-20">
      <div className="px-5 mb-7 flex items-center gap-3">
        <img src={logoImg} alt="GridX Logo" className="w-9 h-9 rounded-lg object-cover border border-[#1e3450]" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white leading-tight">GridX</h1>
          <p className="text-[10px] text-violet-300/70 font-mono tracking-wider">DATA ENGINEERING</p>
        </div>
      </div>

      <div className="flex-1 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 mt-2 text-[10px] font-bold uppercase tracking-widest text-blue-200/40">Workspace</div>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setView(n.id)}
            className={`sidebar-item group w-full ${view === n.id ? 'sidebar-item-active' : ''}`}>
            <n.icon size={18} className={`${n.color} transition-colors`} />
            <span>{n.label}</span>
          </button>
        ))}

        <div className="px-3 mb-2 mt-8 text-[10px] font-bold uppercase tracking-widest text-blue-200/40">Layers</div>
        <div className="px-3 space-y-2">
          {LAYERS.filter((l) => l.id !== 'source' || ws.files.input).map((l) => {
            const tables = ws.tables.filter((t) => t.layer === l.id);
            const predicted = tables.some((t) => t.predicted);
            const cols = tables.reduce((n, t) => n + t.columns.length, 0);
            const traced = l.id === 'source' ? cols
              : tables.reduce((n, t) => n + t.columns.filter((c) => graph.up.has(c.id)).length, 0);
            return (
              <div key={l.id} className="text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-white/75">
                    <span className="w-2 h-2 rounded-full" style={{ background: tables.length ? l.color : 'transparent', border: `1.5px solid ${l.color}` }} />
                    {l.label.replace(' Layer', '').replace(' System', '')}
                  </span>
                  <span className="font-mono text-white/40">
                    {tables.length ? `${tables.length}t · ${cols}c` : '—'}
                  </span>
                </div>
                {tables.length > 0 && l.id !== 'source' && (
                  <div className="ml-4 mt-1 h-1 rounded-full bg-white/10 overflow-hidden" title={`${traced} of ${cols} columns traced upstream`}>
                    <div className="h-full rounded-full" style={{ width: `${cols ? (traced / cols) * 100 : 0}%`, background: l.color, opacity: l.id === 'input' && !ws.showSource ? 0.3 : 0.8 }} />
                  </div>
                )}
                {predicted && <div className="ml-4 mt-0.5 text-[10px] text-amber-300/80">contains predictions</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 pt-4 mt-auto border-t border-white/5 space-y-3">
        <div className="flex gap-2">
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-[11px] text-white/70">
            <Undo2 size={13} /> Undo
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-[11px] text-white/70">
            <Redo2 size={13} /> Redo
          </button>
        </div>
        <button onClick={switchMode} title="Switch between SCADA Automation and Data Engineering"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-[11px] text-white/60 hover:text-white/80 font-medium">
          <Repeat size={14} className="text-sky-300" />
          Switch workspace
        </button>
        <button onClick={toggleDarkMode}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
          <span className="flex items-center gap-2 text-[11px] text-white/60 font-medium">
            {isDarkMode ? <Moon size={14} className="text-blue-300" /> : <Sun size={14} className="text-amber-300" />}
            {isDarkMode ? 'Dark Mode' : 'Light Mode'}
          </span>
          <span className={`relative w-8 h-4 rounded-full transition-all ${isDarkMode ? 'bg-blue-500/60' : 'bg-white/20'}`}>
            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${isDarkMode ? 'left-4' : 'left-0.5'}`} />
          </span>
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const { view, ready, undo, redo } = useDE();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"], .ag-cell-edit-wrapper')) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="flex h-screen w-full bg-surface overflow-hidden">
      <DESidebar />
      <main className="flex-1 overflow-hidden relative min-w-0">
        <ErrorBoundary key={view} label={`de:${view}`}>
          {!ready ? (
            <div className="h-full flex items-center justify-center text-on-surface-variant text-sm">Restoring your last pipeline…</div>
          ) : view === 'setup' ? <SetupView />
            : view === 'canvas' ? <CanvasView />
              : view === 'catalog' ? <CatalogView />
                : <InsightsView />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function DataEngineeringApp() {
  return (
    <DEProvider>
      <Shell />
    </DEProvider>
  );
}
