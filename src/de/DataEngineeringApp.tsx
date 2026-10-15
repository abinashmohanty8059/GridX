import { useEffect, useState } from 'react';
import {
  BookOpen, Moon, PanelLeftClose, PanelLeftOpen, Redo2, Repeat, Sun, Table2, Undo2, UploadCloud, Waypoints,
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
  // Collapsed = icon rail. Remembered between sessions.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('gridx-de-nav') === 'collapsed'; } catch { return false; }
  });
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem('gridx-de-nav', c ? 'open' : 'collapsed'); } catch { /* ignore */ }
    return !c;
  });
  const small = 'w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-[11px] text-white/70';

  return (
    <div className={`de-glass-nav m-2 mr-0 rounded-2xl flex flex-col py-4 shrink-0 text-white z-20 transition-[width] duration-200 ${collapsed ? 'w-[68px]' : 'w-60'}`}
      style={{ height: 'calc(100vh - 16px)' }}>
      <div className={`mb-6 flex items-center ${collapsed ? 'flex-col gap-3 px-2' : 'gap-3 px-4'}`}>
        <img src={logoImg} alt="GridX Logo" className="w-9 h-9 rounded-xl object-cover border border-white/10 shrink-0" />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-white leading-tight">GridX</h1>
            <p className="text-[9.5px] text-violet-300/70 font-mono tracking-wide whitespace-nowrap">DATA ENGINEERING</p>
          </div>
        )}
        <button onClick={toggle} title={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer">
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-200/40">Workspace</div>}
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setView(n.id)} title={collapsed ? n.label : undefined}
            className={`sidebar-item group w-full !rounded-xl ${collapsed ? '!justify-center !px-0' : ''} ${view === n.id ? 'sidebar-item-active' : ''}`}>
            <n.icon size={18} className={`${n.color} transition-colors shrink-0`} />
            {!collapsed && <span>{n.label}</span>}
          </button>
        ))}

        {!collapsed && <div className="px-3 mb-2 mt-8 text-[10px] font-bold uppercase tracking-widest text-blue-200/40">Layers</div>}
        <div className={collapsed ? 'pt-6 flex flex-col items-center gap-3' : 'px-3 space-y-2'}>
          {LAYERS.filter((l) => l.id !== 'source' || ws.files.input).map((l) => {
            const tables = ws.tables.filter((t) => t.layer === l.id);
            const predicted = tables.some((t) => t.predicted);
            const cols = tables.reduce((n, t) => n + t.columns.length, 0);
            const traced = l.id === 'source' ? cols
              : tables.reduce((n, t) => n + t.columns.filter((c) => graph.up.has(c.id)).length, 0);
            const dot = <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tables.length ? l.color : 'transparent', border: `1.5px solid ${l.color}` }} />;
            if (collapsed) {
              return <span key={l.id} title={`${l.label}: ${tables.length} tables · ${cols} columns`}>{dot}</span>;
            }
            return (
              <div key={l.id} className="text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-white/75">
                    {dot}
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

      <div className={`pt-4 mt-auto border-t border-white/5 space-y-2 ${collapsed ? 'px-2' : 'px-4'}`}>
        <div className={`flex gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className={`${small} py-1.5 disabled:opacity-30 disabled:cursor-not-allowed`}>
            <Undo2 size={13} /> {!collapsed && 'Undo'}
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" className={`${small} py-1.5 disabled:opacity-30 disabled:cursor-not-allowed`}>
            <Redo2 size={13} /> {!collapsed && 'Redo'}
          </button>
        </div>
        <button onClick={switchMode} title="Switch between SCADA Automation and Data Engineering" className={`${small} py-2 ${collapsed ? '' : '!justify-start px-3'}`}>
          <Repeat size={14} className="text-sky-300" /> {!collapsed && 'Switch workspace'}
        </button>
        <button onClick={toggleDarkMode} title={isDarkMode ? 'Dark mode' : 'Light mode'} className={`${small} py-2 ${collapsed ? '' : '!justify-between px-3'}`}>
          <span className="flex items-center gap-2">
            {isDarkMode ? <Moon size={14} className="text-blue-300" /> : <Sun size={14} className="text-amber-300" />}
            {!collapsed && (isDarkMode ? 'Dark Mode' : 'Light Mode')}
          </span>
          {!collapsed && (
            <span className={`relative w-8 h-4 rounded-full transition-all ${isDarkMode ? 'bg-blue-500/60' : 'bg-white/20'}`}>
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${isDarkMode ? 'left-4' : 'left-0.5'}`} />
            </span>
          )}
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
    <div className="de-shell flex h-screen w-full overflow-hidden">
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
