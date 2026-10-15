import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, BackgroundVariant, Controls, Edge, MarkerType, MiniMap, Node, ReactFlow, ReactFlowProvider,
  useNodesState, useReactFlow, useStore,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff, LayoutGrid, Magnet, Maximize2, PanelRightOpen, Search, UploadCloud, X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { info as logInfo } from '@tauri-apps/plugin-log';
import { useDE } from '../store';
import { traceColumn } from '../graph';
import { computeView, layoutCanvas, lanesFor, LAYOUT_PRESETS, LayoutPreset, NodeView, SPACING, Spacing, WRAP_AT } from '../layout';
import { LayerId, layerMeta } from '../types';
import { EDGE_INFO } from '../explain';
import { CanvasActions, CanvasCtx, HoverState } from '../canvas/canvasContext';
import { ColumnFlags, TableNode, TableNodeData } from '../canvas/TableNode';
import { LaneNode, LaneNodeData } from '../canvas/LaneNode';
import HoverCard from '../canvas/ColumnTooltip';
import { FlowEdge, FlowEdgeData } from '../canvas/FlowEdge';
import Inspector from '../canvas/Inspector';

const nodeTypes = { table: TableNode, lane: LaneNode };
const edgeTypes = { flow: FlowEdge };
const MIN_ZOOM = 0.03;
const MAX_ZOOM = 2.5;

function ZoomBadge() {
  const zoom = useStore((s) => s.transform[2]);
  return (
    <div className="absolute bottom-4 left-14 z-10 px-2 py-1 rounded-md border border-border bg-surface-container-lowest text-[11px] font-mono text-on-surface-variant pointer-events-none">
      {Math.round(zoom * 100)}%
    </div>
  );
}
type EdgeMode = 'lineage' | 'relations';
const PAGE = 40;

function SearchBox({ onPick }: { onPick: (kind: 'table' | 'column', id: string) => void }) {
  const { graph } = useDE();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const out: { kind: 'table' | 'column'; id: string; label: string; sub: string; layer: LayerId; score: number }[] = [];
    for (const t of graph.tables) {
      const tn = t.name.toLowerCase();
      if (tn.includes(s)) out.push({ kind: 'table', id: t.id, label: t.name, sub: `${t.columns.length} columns`, layer: t.layer, score: tn === s ? 0 : tn.startsWith(s) ? 1 : 2 });
      for (const c of t.columns) {
        const cn = c.name.toLowerCase();
        if (cn.includes(s)) out.push({ kind: 'column', id: c.id, label: c.name, sub: t.name, layer: t.layer, score: cn === s ? 1 : cn.startsWith(s) ? 2 : 3 });
      }
    }
    return out.sort((a, b) => a.score - b.score || a.label.length - b.label.length).slice(0, 40);
  }, [q, graph]);
  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-surface-container-lowest w-64">
        <Search size={14} className="text-on-surface-variant" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder="Find a table or column…" className="flex-1 bg-transparent outline-none text-[12px] text-on-surface min-w-0" />
        {q && <button onClick={() => setQ('')} className="text-on-surface-variant cursor-pointer"><X size={12} /></button>}
      </div>
      {open && results.length > 0 && (
        <div className="nowheel absolute top-full mt-1 left-0 w-96 max-h-96 overflow-y-auto glass-card-elevated !rounded-xl p-1 z-40" onMouseLeave={() => setOpen(false)}>
          {results.map((r) => (
            <button key={`${r.kind}:${r.id}`} className="menu-item-de !py-1.5" onClick={() => { onPick(r.kind, r.id); setOpen(false); }}>
              <span className="text-[9px] font-bold px-1 rounded shrink-0" style={{ background: `${layerMeta(r.layer).color}22`, color: layerMeta(r.layer).color }}>{layerMeta(r.layer).short}</span>
              <span className={`font-mono text-[11.5px] truncate ${r.kind === 'table' ? 'font-bold' : ''}`}>{r.label}</span>
              <span className="text-[10.5px] text-on-surface-variant truncate ml-auto">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Canvas() {
  const { graph, ws, selection, select, setView } = useDE();
  const { isDarkMode } = useTheme();
  const rf = useReactFlow();

  // The source lane mirrors the input lane 1:1, so it starts hidden (SRC chip shows it).
  const [hiddenLayers, setHiddenLayers] = useState<Set<LayerId>>(new Set(['source']));
  const [mode, setMode] = useState<EdgeMode>('lineage');
  const [hideIsolated, setHideIsolated] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [hover, setHover] = useState<HoverState | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const manualPos = useRef(new Map<string, { x: number; y: number }>());
  const [layoutNonce, setLayoutNonce] = useState(0);
  const [preset, setPreset] = useState<LayoutPreset>('lr');
  const [spacing, setSpacing] = useState<Spacing>('normal');
  const [snap, setSnap] = useState(false);
  const [lineDetail, setLineDetail] = useState<'table' | 'column'>('table');
  const [layoutOpen, setLayoutOpen] = useState(false);
  const vertical = LAYOUT_PRESETS[preset].opts.orientation === 'TB';
  const clickedOnCanvas = useRef(false);

  // ── Focus / trace ─────────────────────────────────────────────────────────
  const trace = useMemo(() => (selection?.kind === 'column' && graph.colById.has(selection.id) ? traceColumn(graph, selection.id) : null), [selection, graph]);
  const selTable = selection?.kind === 'table' ? selection.id : selection?.kind === 'column' ? graph.colById.get(selection.id)?.table.id : undefined;
  const neighbours = useMemo(() => {
    if (selection?.kind !== 'table') return null;
    const s = new Set([selection.id]);
    for (const e of graph.tableEdges) { if (e.from === selection.id) s.add(e.to); if (e.to === selection.id) s.add(e.from); }
    for (const r of graph.relations) { if (r.fromTable === selection.id) s.add(r.toTable); if (r.toTable === selection.id) s.add(r.fromTable); }
    return s;
  }, [selection, graph]);

  // ── Which tables are on the canvas ────────────────────────────────────────
  const lanes = useMemo(() => lanesFor(graph, hiddenLayers), [graph, hiddenLayers]);
  const visibleTables = useMemo(() => {
    const laneSet = new Set(lanes);
    let ts = graph.tables.filter((t) => laneSet.has(t.layer));
    if (hideIsolated) {
      const connected = new Set<string>();
      graph.tableEdges.forEach((e) => {
        const a = graph.tableById.get(e.from)!; const b = graph.tableById.get(e.to)!;
        if (laneSet.has(a.layer) && laneSet.has(b.layer) && a.layer !== 'source') { connected.add(e.from); connected.add(e.to); }
      });
      ts = ts.filter((t) => connected.has(t.id) || t.layer === 'output' || trace?.tables.has(t.id) || t.id === selTable);
      // Source objects only when the input table they land in is shown.
      const shown = new Set(ts.map((t) => t.id));
      ts = ts.filter((t) => t.layer !== 'source' || graph.tableEdges.some((e) => e.from === t.id && shown.has(e.to)));
    }
    return ts;
  }, [graph, lanes, hideIsolated, trace, selTable]);

  const pinned = useMemo(() => new Set(trace ? [...trace.cols.keys()] : []), [trace]);
  const views = useMemo(() => {
    const m = new Map<string, NodeView>();
    const perLane = new Map<LayerId, number>();
    visibleTables.forEach((t) => perLane.set(t.layer, (perLane.get(t.layer) ?? 0) + 1));
    for (const t of visibleTables) {
      m.set(t.id, computeView(t, {
        expanded: expanded.has(t.id), limit: limits[t.id] ?? PAGE, filter: filters[t.id] ?? '', pinned,
        compact: (perLane.get(t.layer) ?? 0) > WRAP_AT,
      }));
    }
    return m;
  }, [visibleTables, expanded, limits, filters, pinned]);

  // Only re-run the layout when a node's size or the set of tables changes.
  const layoutKey = `${lanes.join()}|${[...views.values()].map((v) => `${v.table.id}:${v.height}`).join()}|${layoutNonce}|${preset}|${spacing}`;
  const layout = useMemo(() => layoutCanvas(graph, views, lanes, { ...LAYOUT_PRESETS[preset].opts, spacing: SPACING[spacing] }), [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-column flags for the row indicators ───────────────────────────────
  const flags = useMemo(() => {
    const f: Record<string, ColumnFlags> = {};
    graph.colById.forEach(({ col }, id) => {
      const ups = graph.up.get(id) ?? [];
      f[id] = {
        calc: ups.some((e) => e.kind === 'calc' || e.kind === 'agg'),
        lookup: col.lookup || ups.some((e) => e.kind === 'lookup'),
        traced: ups.length > 0,
        down: (graph.down.get(id) ?? []).length,
      };
    });
    return f;
  }, [graph]);

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const builtNodes = useMemo(() => {
    const ns: Node[] = [];
    for (const lb of layout.laneBoxes) {
      const ts = visibleTables.filter((t) => t.layer === lb.layer);
      const cols = ts.flatMap((t) => t.columns);
      ns.push({
        id: `lane:${lb.layer}`, type: 'lane', position: { x: lb.x, y: lb.y }, draggable: false, selectable: false, zIndex: -1,
        data: {
          meta: layerMeta(lb.layer), width: lb.width, height: lb.height, tables: ts.length, columns: cols.length,
          traced: cols.filter((c) => flags[c.id]?.traced).length, predicted: ts.filter((t) => t.predicted).length,
        } satisfies LaneNodeData,
      });
    }
    for (const t of visibleTables) {
      const v = views.get(t.id)!;
      const traceSub: Record<string, number> | null = trace ? {} : null;
      if (trace && traceSub) for (const c of v.visible) { const d = trace.cols.get(c.id); if (d !== undefined) traceSub[c.id] = d; }
      const dimmed = trace ? !trace.tables.has(t.id) : neighbours ? !neighbours.has(t.id) : false;
      ns.push({
        id: t.id, type: 'table',
        position: manualPos.current.get(t.id) ?? layout.pos.get(t.id) ?? { x: 0, y: 0 },
        data: {
          view: v, role: graph.roles.get(t.id) ?? 'reference', color: layerMeta(t.layer).color,
          selected: selection?.kind === 'table' && selection.id === t.id, dimmed,
          activeCol: selection?.kind === 'column' ? selection.id : null, trace: traceSub,
          flags, filter: filters[t.id] ?? '', showUntraced: t.layer !== 'source', vertical,
        } satisfies TableNodeData,
      });
    }
    return ns;
  }, [layout, visibleTables, views, trace, neighbours, selection, graph, flags, filters, vertical]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  useEffect(() => {
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]));
      return builtNodes.map((n) => {
        const o = old.get(n.id);
        return o ? { ...n, measured: o.measured, width: o.width, height: o.height } : n;
      });
    });
  }, [builtNodes, setNodes]);

  // ── Edges ─────────────────────────────────────────────────────────────────
  // What the pointer is over drives a temporary highlight, like Supabase's schema view.
  const hoverTable = hover?.kind === 'table' ? hover.id : hover?.kind === 'column' ? graph.colById.get(hover.id)?.table.id : undefined;
  const hoverCol = hover?.kind === 'column' ? hover.id : undefined;
  const hoverEdge = hover?.kind === 'edge' ? hover.id : undefined;

  const edges = useMemo(() => {
    const out: Edge[] = [];
    const shown = new Set(visibleTables.map((t) => t.id));
    const visibleCols = new Map<string, Set<string>>();
    views.forEach((v, id) => visibleCols.set(id, new Set(v.visible.map((c) => c.id))));
    const handle = (colId: string, side: 'out' | 'in' | 'rin') => {
      const r = graph.colById.get(colId)!;
      if (visibleCols.get(r.table.id)?.has(colId)) return `${colId}-${side}`;
      return side === 'out' ? 't-out' : side === 'in' ? 't-in' : 't-rel-in';
    };
    const mk = (id: string, source: string, target: string, sh: string, th: string, data: FlowEdgeData, arrow?: string, zIndex = 0): Edge => ({
      id, source, target, sourceHandle: sh, targetHandle: th, type: 'flow', data, zIndex,
      markerEnd: arrow ? { type: MarkerType.ArrowClosed, color: arrow, width: 9, height: 9 } : undefined,
    });
    const neutral = isDarkMode ? '#475569' : '#a3b1c2';
    const focusing = !!(trace || neighbours);
    const anyHover = !!(hoverTable || hoverEdge);

    if (mode === 'lineage') {
      // Column-to-column lines: the traced path, or the hovered column's own links.
      const colEdges = trace
        ? graph.edges.filter((e) => trace.edges.has(e.id))
        : hoverCol ? [...(graph.up.get(hoverCol) ?? []), ...(graph.down.get(hoverCol) ?? [])] : [];
      for (const e of colEdges) {
        const a = graph.colById.get(e.from)!.table; const b = graph.colById.get(e.to)!.table;
        if (!shown.has(a.id) || !shown.has(b.id)) continue;
        const info = EDGE_INFO[e.kind];
        const same = a.id === b.id;
        out.push(mk(e.id, a.id, b.id, handle(e.from, 'out'), handle(e.to, same ? 'rin' : 'in'), {
          color: info.color, width: hoverEdge === e.id ? 3 : 2, opacity: 0.4 + e.confidence * 0.6, dash: info.dash, loop: same,
        }, info.color, 5));
      }
      const focusId = selection?.kind === 'table' ? selection.id : undefined;
      if (lineDetail === 'column' && !trace) {
        // Every column link drawn row to row. Links whose columns are folded away
        // attach to the table header and are bundled into one line with a count.
        const bundles = new Map<string, { a: string; b: string; sh: string; th: string; n: number; kind: string; id: string }>();
        for (const e of graph.edges) {
          const a = graph.colById.get(e.from)!.table.id; const b = graph.colById.get(e.to)!.table.id;
          if (a === b || !shown.has(a) || !shown.has(b)) continue;
          const sh = handle(e.from, 'out'); const th = handle(e.to, 'in');
          const k = `${a}|${sh}|${b}|${th}`;
          const x = bundles.get(k);
          if (x) x.n++; else bundles.set(k, { a, b, sh, th, n: 1, kind: e.kind, id: e.id });
        }
        bundles.forEach((x, k) => {
          const rowLevel = x.sh !== 't-out' || x.th !== 't-in';
          const hot = !!hoverTable && (x.a === hoverTable || x.b === hoverTable);
          const on = focusId ? x.a === focusId || x.b === focusId : false;
          const active = on || hot;
          const opacity = focusing ? (on ? 0.95 : 0.05) : anyHover ? (active ? 1 : 0.08) : rowLevel ? 0.7 : 0.4;
          const kindColor = EDGE_INFO[x.kind].color;
          out.push(mk(x.n === 1 ? x.id : `cb:${k}`, x.a, x.b, x.sh, x.th, {
            color: active || rowLevel ? kindColor : neutral,
            width: rowLevel ? 1.2 : 1 + Math.min(1.2, Math.log2(x.n) / 4),
            opacity, dash: rowLevel ? EDGE_INFO[x.kind].dash : undefined,
            label: active && x.n > 1 ? `${x.n} cols` : undefined,
          }, rowLevel ? kindColor : undefined, active ? 4 : 1));
        });
      }
      for (const te of (lineDetail === 'column' && !trace ? [] : graph.tableEdges)) {
        if (!shown.has(te.from) || !shown.has(te.to)) continue;
        const on = focusId ? te.from === focusId || te.to === focusId : false;
        const hot = !focusing && !!hoverTable && (te.from === hoverTable || te.to === hoverTable);
        const isHover = hoverEdge === te.id;
        const active = on || hot || isHover;
        const opacity = trace ? 0.05 : focusing ? (on ? 0.95 : 0.05) : anyHover ? (active ? 1 : 0.1) : 0.55;
        out.push(mk(te.id, te.from, te.to, 't-out', 't-in', {
          color: active ? layerMeta(graph.tableById.get(te.to)!.layer).color : neutral,
          width: (active ? 1.6 : 1) + Math.min(1.4, Math.log2(te.count) / 4),
          opacity,
          label: active ? `${te.count} col${te.count > 1 ? 's' : ''}` : undefined,
        }, undefined, active ? 4 : 0));
      }
    } else {
      // Relationships: FK → PK, aggregated per table pair unless a table is focused or hovered.
      const pairs = new Map<string, { from: string; to: string; rels: typeof graph.relations }>();
      for (const r of graph.relations) {
        if (!shown.has(r.fromTable) || !shown.has(r.toTable)) continue;
        const k = `${r.fromTable}>${r.toTable}`;
        const p = pairs.get(k) ?? { from: r.fromTable, to: r.toTable, rels: [] };
        p.rels.push(r); pairs.set(k, p);
      }
      const focusT = selTable ?? hoverTable;
      pairs.forEach((p, k) => {
        const on = focusT ? p.from === focusT || p.to === focusT : false;
        if (on || (lineDetail === 'column' && !focusT)) {
          for (const r of p.rels) {
            out.push(mk(r.id, p.from, p.to, handle(r.from, 'out'), handle(r.to, 'rin'), {
              color: '#64748b', width: hoverEdge === r.id ? 2.6 : 1.8, opacity: 1, dash: '4 3', loop: true, label: 'FK',
            }, '#64748b', 5));
          }
        } else {
          const isHover = hoverEdge === `rel:${k}`;
          out.push(mk(`rel:${k}`, p.from, p.to, 't-rel-out', 't-rel-in', {
            color: isHover ? '#64748b' : neutral, width: isHover ? 2 : 1 + Math.min(1, p.rels.length / 4), dash: '4 3', loop: true,
            opacity: focusT ? 0.06 : isHover ? 1 : 0.6,
          }));
        }
      });
    }
    return out;
  }, [mode, trace, neighbours, graph, visibleTables, views, selection, selTable, isDarkMode, hoverTable, hoverCol, hoverEdge, lineDetail]);

  // ── Trackpad & mouse: pinch / Ctrl+scroll zooms, two-finger swipe pans, mouse wheel zooms ──
  const wrapRef = useRef<HTMLDivElement>(null);
  // One log line per gesture (until 60 lines) so trackpad behaviour can be diagnosed from the log file.
  const gesture = useRef<{ n: number; ctrl: number; dx: number; dy: number; min: number; max: number; modes: string; z0: number; timer?: number } | null>(null);
  const gesturesLogged = useRef(0);
  const hasTables = ws.tables.length > 0;
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const record = (e: WheelEvent, zoomBefore: number) => {
      if (gesturesLogged.current >= 60) return;
      let g = gesture.current;
      if (!g) g = gesture.current = { n: 0, ctrl: 0, dx: 0, dy: 0, min: Infinity, max: -Infinity, modes: '', z0: zoomBefore };
      g.n++; if (e.ctrlKey) g.ctrl++;
      g.dx += e.deltaX; g.dy += e.deltaY;
      g.min = Math.min(g.min, e.deltaY); g.max = Math.max(g.max, e.deltaY);
      if (!g.modes.includes(String(e.deltaMode))) g.modes += e.deltaMode;
      window.clearTimeout(g.timer);
      g.timer = window.setTimeout(() => {
        const x = gesture.current!;
        gesture.current = null;
        gesturesLogged.current++;
        logInfo(`canvas wheel gesture: events=${x.n} ctrl=${x.ctrl} sumDX=${x.dx.toFixed(1)} sumDY=${x.dy.toFixed(1)} dy[min,max]=[${x.min.toFixed(1)},${x.max.toFixed(1)}] mode=${x.modes} zoom ${Math.round(x.z0 * 100)}%->${Math.round(rf.getViewport().zoom * 100)}%`).catch(() => { /* browser */ });
      }, 400);
    };
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.nowheel') || !target.closest('.react-flow')) return;
      e.preventDefault();
      e.stopPropagation();
      const vp = rf.getViewport();
      record(e, vp.zoom);
      // Mouse wheels send whole "notches" (±100 on Windows); precision trackpads send small deltas.
      const mouseWheel = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
      if (e.ctrlKey || e.metaKey || (mouseWheel && !e.shiftKey)) {
        const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
        // Pinch arrives as Ctrl+wheel. Some touchpad drivers send small fractional steps,
        // others send ±100 "notches" — both zoom, and one step never jumps more than 35%.
        const speed = Math.abs(delta) >= 50 ? 0.0025 : 0.035;
        const factor = Math.min(1.35, Math.max(1 / 1.35, Math.exp(-delta * speed)));
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * factor));
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left; const py = e.clientY - rect.top;
        const k = zoom / vp.zoom;
        rf.setViewport({ x: px - (px - vp.x) * k, y: py - (py - vp.y) * k, zoom });
      } else if (mouseWheel && e.shiftKey) {
        rf.setViewport({ x: vp.x - e.deltaY, y: vp.y, zoom: vp.zoom });
      } else {
        rf.setViewport({ x: vp.x - e.deltaX, y: vp.y - e.deltaY, zoom: vp.zoom });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [rf, hasTables]);

  // If the webview ever zooms the whole page itself (pinch not handed to the canvas), record it.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let logged = false;
    const onResize = () => {
      if (logged || Math.abs(vv.scale - 1) < 0.01) return;
      logged = true;
      logInfo(`canvas: webview zoomed the page natively (visual scale=${vv.scale.toFixed(2)})`).catch(() => { /* browser */ });
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Keyboard zoom: Ctrl + = / Ctrl + - / Ctrl + 0 (fit).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); rf.zoomIn({ duration: 150 }); }
      else if (e.key === '-') { e.preventDefault(); rf.zoomOut({ duration: 150 }); }
      else if (e.key === '0') { e.preventDefault(); rf.fitView({ padding: 0.08, duration: 300 }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rf]);

  // ── Actions for nodes ─────────────────────────────────────────────────────
  const actions = useMemo<CanvasActions>(() => ({
    hover: setHover,
    selectTable: (id) => { clickedOnCanvas.current = true; select({ kind: 'table', id }); setInspectorOpen(true); },
    selectColumn: (id) => { clickedOnCanvas.current = true; select({ kind: 'column', id }); setInspectorOpen(true); },
    toggleExpand: (id) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    showMore: (id) => setLimits((l) => ({ ...l, [id]: (l[id] ?? PAGE) + PAGE * 2 })),
    setFilter: (id, text) => setFilters((f) => ({ ...f, [id]: text })),
  }), [select]);

  // Zoom to whatever was selected from outside the canvas (search, catalog, insights).
  useEffect(() => {
    if (!selection) return;
    if (clickedOnCanvas.current) { clickedOnCanvas.current = false; return; }
    const ids = selection.kind === 'table' ? [selection.id] : trace ? [...trace.tables] : [];
    const t = window.setTimeout(() => {
      if (ids.length) rf.fitView({ nodes: ids.map((id) => ({ id })), duration: 500, padding: 0.25, maxZoom: 1.1 });
    }, 60);
    return () => window.clearTimeout(t);
  }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps

  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !nodes.length) return;
    fitted.current = true;
    // Open on the layers after input — that's where the interesting joins and calculations are.
    const later = visibleTables.filter((t) => t.layer !== 'source' && t.layer !== 'input').map((t) => ({ id: t.id }));
    window.setTimeout(() => rf.fitView(later.length
      ? { nodes: later, padding: 0.15, maxZoom: 0.9, duration: 300 }
      : { padding: 0.08, duration: 300 }), 80);
  }, [nodes.length, rf]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyLayout = (p: LayoutPreset, sp: Spacing) => {
    manualPos.current.clear();
    setPreset(p); setSpacing(sp);
    window.setTimeout(() => rf.fitView({ padding: 0.08, duration: 400 }), 120);
  };

  const relayout = useCallback(() => {
    manualPos.current.clear();
    setLayoutNonce((n) => n + 1);
    window.setTimeout(() => rf.fitView({ padding: 0.08, duration: 400 }), 80);
  }, [rf]);

  if (!ws.tables.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><UploadCloud size={26} /></div>
        <div>
          <div className="font-bold text-on-surface text-lg">No pipeline loaded yet</div>
          <div className="text-sm text-on-surface-variant mt-1">Upload at least your input layer to draw the canvas.</div>
        </div>
        <button onClick={() => setView('setup')} className="btn-de">Go to Pipeline Setup</button>
      </div>
    );
  }

  return (
    <CanvasCtx.Provider value={actions}>
      <div className="h-full flex">
        <div ref={wrapRef} className="flex-1 relative min-w-0">
          {/* Toolbar */}
          <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
            <div className="pointer-events-auto"><SearchBox onPick={(kind, id) => select({ kind, id })} /></div>
            <div className="pointer-events-auto flex rounded-lg border border-border bg-surface-container-lowest overflow-hidden" title="What the lines show">
              {(['table', 'column'] as const).map((d) => (
                <button key={d} onClick={() => setLineDetail(d)}
                  className={`px-3 py-1.5 text-[12px] font-semibold cursor-pointer ${lineDetail === d ? 'bg-[#0D1B2A] text-white' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                  {d === 'table' ? 'Table lines' : 'Column lines'}
                </button>
              ))}
            </div>
            <div className="pointer-events-auto flex rounded-lg border border-border bg-surface-container-lowest overflow-hidden">
              {(['lineage', 'relations'] as EdgeMode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-[12px] font-semibold cursor-pointer ${mode === m ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                  {m === 'lineage' ? 'Lineage' : 'Relationships'}
                </button>
              ))}
            </div>
            <div className="pointer-events-auto flex gap-1">
              {graph.layersPresent.map((l) => {
                const m = layerMeta(l); const off = hiddenLayers.has(l);
                return (
                  <button key={l} title={`${off ? 'Show' : 'Hide'} ${m.label}`}
                    onClick={() => setHiddenLayers((s) => { const n = new Set(s); if (n.has(l)) n.delete(l); else n.add(l); return n; })}
                    className="px-2 py-1.5 rounded-lg border text-[10.5px] font-bold cursor-pointer bg-surface-container-lowest"
                    style={{ borderColor: off ? 'var(--color-border)' : m.color, color: off ? 'var(--color-on-surface-variant)' : m.color, opacity: off ? 0.6 : 1 }}>
                    {m.short}
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-auto flex gap-1">
              <button onClick={() => setHideIsolated((v) => !v)} className={`btn-de ${hideIsolated ? 'btn-de-active' : ''}`} title="Hide tables with no lineage to other visible tables">
                {hideIsolated ? <EyeOff size={13} /> : <Eye size={13} />} Unconnected
              </button>
              <button onClick={() => setExpanded(new Set(visibleTables.filter((t) => t.layer !== 'source' && t.layer !== 'input').map((t) => t.id)))} className="btn-de" title="Expand derived, semantic and output tables">
                <ChevronsUpDown size={13} />
              </button>
              <button onClick={() => setExpanded(new Set())} className="btn-de" title="Collapse all"><ChevronsDownUp size={13} /></button>
              <div className="relative">
                <button onClick={() => setLayoutOpen((v) => !v)} className={`btn-de ${layoutOpen ? 'btn-de-active' : ''}`} title="Table layout options">
                  <LayoutGrid size={13} /> Layout <ChevronDown size={11} />
                </button>
                {layoutOpen && (
                  <div className="nowheel absolute right-0 mt-1 w-72 glass-card-elevated !rounded-xl p-2 z-40">
                    <div className="label-caps !text-[10px] px-2 pt-1 pb-1.5">Arrangement</div>
                    {(Object.keys(LAYOUT_PRESETS) as LayoutPreset[]).map((k) => (
                      <button key={k} onClick={() => applyLayout(k, spacing)} className="menu-item-de !items-start">
                        <span className="w-4 shrink-0 pt-0.5">{preset === k && <Check size={13} className="text-primary" />}</span>
                        <span>
                          <span className="block font-semibold">{LAYOUT_PRESETS[k].label}</span>
                          <span className="block text-[10.5px] text-on-surface-variant">{LAYOUT_PRESETS[k].hint}</span>
                        </span>
                      </button>
                    ))}
                    <div className="label-caps !text-[10px] px-2 pt-2 pb-1.5">Spacing</div>
                    <div className="flex gap-1 px-2">
                      {(['tight', 'normal', 'roomy'] as Spacing[]).map((sp) => (
                        <button key={sp} onClick={() => applyLayout(preset, sp)} className={`btn-de-sm flex-1 justify-center capitalize ${spacing === sp ? 'btn-de-active' : ''}`}>{sp}</button>
                      ))}
                    </div>
                    <div className="h-px bg-border my-2" />
                    <button onClick={() => setSnap((v) => !v)} className="menu-item-de">
                      <Magnet size={13} className={snap ? 'text-primary' : 'text-on-surface-variant'} />
                      <span className="flex-1">Snap tables to a grid when dragging</span>
                      {snap && <Check size={13} className="text-primary" />}
                    </button>
                    <button onClick={() => { relayout(); setLayoutOpen(false); }} className="menu-item-de">
                      <LayoutGrid size={13} className="text-on-surface-variant" />
                      <span className="flex-1">Reset positions (undo my dragging)</span>
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => rf.fitView({ padding: 0.08, duration: 400 })} className="btn-de" title="Fit to screen"><Maximize2 size={13} /></button>
              {!inspectorOpen && <button onClick={() => setInspectorOpen(true)} className="btn-de" title="Show panel"><PanelRightOpen size={13} /></button>}
            </div>
          </div>

          {selection && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2 rounded-full glass-card-elevated !rounded-full text-[12px] text-on-surface">
              {trace ? <>Tracing <b className="font-mono">{graph.colById.get(selection.id)?.col.name}</b> · {trace.cols.size - 1} connected columns across {trace.tables.size} tables</>
                : <>Focused on <b className="font-mono">{graph.tableById.get(selection.id)?.name}</b></>}
              <button onClick={() => select(null)} className="text-on-surface-variant hover:text-on-surface cursor-pointer flex items-center gap-1"><X size={12} /> Clear</button>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDrag={(_, n) => { manualPos.current.set(n.id, n.position); }}
            onNodeDragStop={(_, n) => { manualPos.current.set(n.id, n.position); }}
            snapToGrid={snap}
            snapGrid={[20, 20]}
            onPaneClick={() => select(null)}
            edgeTypes={edgeTypes}
            onEdgeMouseEnter={(e, edge) => setHover({ kind: 'edge', id: edge.id, x: e.clientX, y: e.clientY })}
            onEdgeMouseMove={(e, edge) => setHover({ kind: 'edge', id: edge.id, x: e.clientX, y: e.clientY })}
            onEdgeMouseLeave={() => setHover(null)}
            // Lines need a click handler to receive hover at all; clicking one focuses what it feeds.
            onEdgeClick={(_, edge) => {
              clickedOnCanvas.current = true;
              const lin = graph.edges.find((x) => x.id === edge.id);
              if (lin) select({ kind: 'column', id: lin.to });
              else select({ kind: 'table', id: edge.target });
            }}
            colorMode={isDarkMode ? 'dark' : 'light'}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            zoomOnScroll={false}
            zoomOnPinch={false}
            panOnScroll={false}
            zoomOnDoubleClick={false}
            edgesFocusable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            onlyRenderVisibleElements
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={isDarkMode ? '#1e293b' : '#cbd5e1'} />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap pannable zoomable position="bottom-right"
              nodeColor={(n) => (n.type === 'lane' ? 'transparent' : (n.data as TableNodeData).color)}
              nodeStrokeColor={(n) => (n.type === 'lane' ? (n.data as LaneNodeData).meta.color : 'transparent')}
              maskColor={isDarkMode ? 'rgba(15,17,23,0.7)' : 'rgba(247,249,251,0.7)'} />
          </ReactFlow>
          {hover && <HoverCard hover={hover} graph={graph} />}
          <ZoomBadge />
        </div>
        {inspectorOpen && <Inspector onClose={() => setInspectorOpen(false)} />}
      </div>
    </CanvasCtx.Provider>
  );
}

export default function CanvasView() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
