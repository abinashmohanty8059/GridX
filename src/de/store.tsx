import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildGraph, Graph, LineageEdge } from './graph';
import { rowsToTables, synthesizeSource } from './parse';
import { predictOutput, predictSemantic } from './predict';
import {
  Column, EdgeKind, emptyWorkspace, HeaderMapping, LayerFile, LayerId, Table, uid, Workspace,
} from './types';

// ─── IndexedDB autosave (workspaces are too large for localStorage) ──────────

const DB = 'gridx-de';
const STORE = 'kv';
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => res(q.result as T);
      q.onerror = () => res(undefined);
    });
  } catch { return undefined; }
}
async function idbSet(key: string, value: unknown) {
  try {
    const db = await idb();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
  } catch { /* storage unavailable: the session still works in memory */ }
}

// ─── Context ─────────────────────────────────────────────────────────────────

export type DEView = 'setup' | 'canvas' | 'catalog' | 'insights';
export type Selection = { kind: 'table'; id: string } | { kind: 'column'; id: string } | null;

export interface LayerFileWithRows extends LayerFile { rows: Record<string, string>[] }

interface DEContextType {
  ws: Workspace;
  graph: Graph;
  ready: boolean;
  view: DEView;
  setView: (v: DEView) => void;
  selection: Selection;
  select: (s: Selection) => void;
  focusColumn: (id: string) => void;
  focusTable: (id: string) => void;

  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  loadLayer: (layer: LayerId, file: LayerFileWithRows) => void;
  remapLayer: (layer: LayerId, mapping: HeaderMapping) => void;
  removeLayer: (layer: LayerId) => void;
  setShowSource: (v: boolean) => void;
  renameWorkspace: (name: string) => void;
  replaceWorkspace: (ws: Workspace) => void;
  resetWorkspace: () => void;

  predict: (layer: 'semantic' | 'output') => number;
  acceptPredictions: (tableId?: string) => void;
  discardPredictions: (layer: LayerId) => void;

  addTable: (layer: LayerId, name: string) => string;
  updateTable: (id: string, patch: Partial<Pick<Table, 'name' | 'description' | 'layer'>>) => void;
  deleteTable: (id: string) => void;
  addColumn: (tableId: string, name: string) => string;
  updateColumn: (id: string, patch: Partial<Omit<Column, 'id' | 'raw'>>) => void;
  deleteColumn: (id: string) => void;
  addLink: (from: string, to: string, kind: EdgeKind, reason?: string) => void;
  removeEdge: (e: LineageEdge) => void;
}

const DEContext = createContext<DEContextType | undefined>(undefined);

const HISTORY = 60;

export function DEProvider({ children }: { children: ReactNode }) {
  const [hist, setHist] = useState<{ past: Workspace[]; present: Workspace; future: Workspace[] }>(
    () => ({ past: [], present: emptyWorkspace(), future: [] }),
  );
  const ws = hist.present;
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<DEView>('setup');
  const [selection, select] = useState<Selection>(null);

  // Restore the last session.
  useEffect(() => {
    idbGet<Workspace>('workspace').then((saved) => {
      if (saved && saved.version === 1) {
        setHist({ past: [], present: saved, future: [] });
        if (saved.tables.length) setView('canvas');
      }
      setReady(true);
    });
  }, []);

  // Debounced autosave.
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!ready) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => idbSet('workspace', ws), 700);
  }, [ws, ready]);

  /** Every edit goes through here so it can be undone. */
  const commit = useCallback((fn: (w: Workspace) => Workspace) => {
    setHist((h) => {
      const next = fn(h.present);
      if (next === h.present) return h;
      return { past: [...h.past.slice(-HISTORY + 1), h.present], present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => setHist((h) => (h.past.length
    ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
    : h)), []);
  const redo = useCallback(() => setHist((h) => (h.future.length
    ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
    : h)), []);

  const graph = useMemo(() => buildGraph(ws), [ws]);

  // ── Layers ────────────────────────────────────────────────────────────────

  const withLayer = (w: Workspace, layer: LayerId, tables: Table[], file?: LayerFileWithRows): Workspace => {
    const drop = new Set(w.tables.filter((t) => t.layer === layer || (layer === 'input' && t.layer === 'source')).map((t) => t.id));
    const next = [...w.tables.filter((t) => !drop.has(t.id)), ...tables];
    if (layer === 'input') next.push(...synthesizeSource(tables));
    const live = new Set(next.flatMap((t) => t.columns.map((c) => c.id)));
    const files = { ...w.files };
    if (file) files[layer] = file; else delete files[layer];
    return {
      ...w,
      tables: next,
      files,
      links: w.links.filter((l) => live.has(l.from) && live.has(l.to)),
      suppressed: w.suppressed.filter((k) => k.split('>').every((id) => live.has(id))),
    };
  };

  const loadLayer = useCallback((layer: LayerId, file: LayerFileWithRows) => {
    commit((w) => withLayer(w, layer, rowsToTables(file.rows, file.mapping, layer), file));
  }, [commit]);

  const remapLayer = useCallback((layer: LayerId, mapping: HeaderMapping) => {
    commit((w) => {
      const f = w.files[layer] as LayerFileWithRows | undefined;
      if (!f) return w;
      const nf = { ...f, mapping };
      return withLayer(w, layer, rowsToTables(f.rows, mapping, layer), nf);
    });
  }, [commit]);

  const removeLayer = useCallback((layer: LayerId) => {
    commit((w) => withLayer(w, layer, []));
    select(null);
  }, [commit]);

  const setShowSource = useCallback((v: boolean) => commit((w) => ({ ...w, showSource: v })), [commit]);
  const renameWorkspace = useCallback((name: string) => commit((w) => ({ ...w, name })), [commit]);
  const replaceWorkspace = useCallback((n: Workspace) => { commit(() => n); select(null); }, [commit]);
  const resetWorkspace = useCallback(() => { commit(() => emptyWorkspace()); select(null); setView('setup'); }, [commit]);

  // ── Predictions ───────────────────────────────────────────────────────────

  const predict = useCallback((layer: 'semantic' | 'output') => {
    const p = layer === 'semantic' ? predictSemantic(ws, graph) : predictOutput(ws, graph);
    if (p.tables.length) {
      commit((w) => ({
        ...w,
        tables: [...w.tables.filter((t) => !(t.layer === layer && t.predicted)), ...p.tables],
        links: [...w.links, ...p.links],
      }));
    }
    return p.tables.length;
  }, [ws, graph, commit]);

  const acceptPredictions = useCallback((tableId?: string) => {
    commit((w) => {
      const accept = new Set(w.tables.filter((t) => t.predicted && (!tableId || t.id === tableId)).map((t) => t.id));
      if (!accept.size) return w;
      const cols = new Set(w.tables.filter((t) => accept.has(t.id)).flatMap((t) => t.columns.map((c) => c.id)));
      return {
        ...w,
        tables: w.tables.map((t) => (accept.has(t.id)
          ? { ...t, predicted: false, columns: t.columns.map((c) => ({ ...c, predicted: false })) }
          : t)),
        links: w.links.map((l) => (cols.has(l.to) ? { ...l, predicted: false, reason: l.reason.replace(/^Predicted: /, '') } : l)),
      };
    });
  }, [commit]);

  const discardPredictions = useCallback((layer: LayerId) => {
    commit((w) => {
      const drop = new Set(w.tables.filter((t) => t.layer === layer && t.predicted).flatMap((t) => t.columns.map((c) => c.id)));
      return {
        ...w,
        tables: w.tables.filter((t) => !(t.layer === layer && t.predicted)),
        links: w.links.filter((l) => !drop.has(l.to) && !drop.has(l.from)),
      };
    });
    select(null);
  }, [commit]);

  // ── Schema edits ──────────────────────────────────────────────────────────

  const mapTables = (w: Workspace, fn: (t: Table) => Table): Workspace => ({ ...w, tables: w.tables.map(fn) });

  const addTable = useCallback((layer: LayerId, name: string) => {
    const id = uid('t');
    commit((w) => ({ ...w, tables: [...w.tables, { id, name, layer, description: '', columns: [] }] }));
    return id;
  }, [commit]);

  const updateTable = useCallback((id: string, patch: Partial<Pick<Table, 'name' | 'description' | 'layer'>>) => {
    commit((w) => mapTables(w, (t) => (t.id === id ? { ...t, ...patch } : t)));
  }, [commit]);

  const deleteTable = useCallback((id: string) => {
    commit((w) => {
      const t = w.tables.find((x) => x.id === id);
      if (!t) return w;
      const cols = new Set(t.columns.map((c) => c.id));
      return {
        ...w,
        tables: w.tables.filter((x) => x.id !== id),
        links: w.links.filter((l) => !cols.has(l.from) && !cols.has(l.to)),
      };
    });
    select(null);
  }, [commit]);

  const addColumn = useCallback((tableId: string, name: string) => {
    const id = uid('c');
    commit((w) => mapTables(w, (t) => (t.id === tableId ? {
      ...t,
      columns: [...t.columns, {
        id, name, definition: '', dataType: '', key: '', origin: '', lookup: false, sourceTable: '', sourceField: '', raw: { Added: 'manually' },
      }],
    } : t)));
    return id;
  }, [commit]);

  const updateColumn = useCallback((id: string, patch: Partial<Omit<Column, 'id' | 'raw'>>) => {
    commit((w) => mapTables(w, (t) => (t.columns.some((c) => c.id === id)
      ? { ...t, columns: t.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
      : t)));
  }, [commit]);

  const deleteColumn = useCallback((id: string) => {
    commit((w) => ({
      ...mapTables(w, (t) => (t.columns.some((c) => c.id === id) ? { ...t, columns: t.columns.filter((c) => c.id !== id) } : t)),
      links: w.links.filter((l) => l.from !== id && l.to !== id),
    }));
    select(null);
  }, [commit]);

  const addLink = useCallback((from: string, to: string, kind: EdgeKind, reason = 'Added manually') => {
    commit((w) => ({
      ...w,
      links: [...w.links, { id: uid('l'), from, to, kind, reason }],
      suppressed: w.suppressed.filter((k) => k !== `${from}>${to}`),
    }));
  }, [commit]);

  const removeEdge = useCallback((e: LineageEdge) => {
    commit((w) => (e.auto
      ? { ...w, suppressed: [...w.suppressed, `${e.from}>${e.to}`] }
      : { ...w, links: w.links.filter((l) => l.id !== e.id) }));
  }, [commit]);

  const focusColumn = useCallback((id: string) => { select({ kind: 'column', id }); setView('canvas'); }, []);
  const focusTable = useCallback((id: string) => { select({ kind: 'table', id }); setView('canvas'); }, []);

  // Drop a selection that no longer exists (after undo / delete).
  useEffect(() => {
    if (!selection) return;
    const gone = selection.kind === 'table' ? !graph.tableById.has(selection.id) : !graph.colById.has(selection.id);
    if (gone) select(null);
  }, [graph, selection]);

  const value: DEContextType = {
    ws, graph, ready, view, setView, selection, select, focusColumn, focusTable,
    canUndo: hist.past.length > 0, canRedo: hist.future.length > 0, undo, redo,
    loadLayer, remapLayer, removeLayer, setShowSource, renameWorkspace, replaceWorkspace, resetWorkspace,
    predict, acceptPredictions, discardPredictions,
    addTable, updateTable, deleteTable, addColumn, updateColumn, deleteColumn, addLink, removeEdge,
  };
  return <DEContext.Provider value={value}>{children}</DEContext.Provider>;
}

export function useDE() {
  const ctx = useContext(DEContext);
  if (!ctx) throw new Error('useDE must be used within a DEProvider');
  return ctx;
}
