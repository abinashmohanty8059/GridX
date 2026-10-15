import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight, ArrowUpLeft, Check, KeyRound, Link2, Lightbulb, Plus, Search, Sparkles, Trash2, X,
} from 'lucide-react';
import { useDE } from '../store';
import { LineageEdge } from '../graph';
import { EdgeKind, KeyType, LayerId, LAYERS, layerMeta, Origin } from '../types';
import { EDGE_INFO, explainColumn, explainTable, ROLE_INFO, columnCounts } from '../explain';

/** Text field that commits on blur / Enter so typing doesn't flood undo history. */
function EditText({ value, onCommit, multiline, placeholder, className = '' }: {
  value: string; onCommit: (v: string) => void; multiline?: boolean; placeholder?: string; className?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => { if (v !== value) onCommit(v); };
  return multiline ? (
    <textarea value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} rows={4}
      className={`de-input resize-y leading-relaxed ${className}`} />
  ) : (
    <input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setV(value); }}
      className={`de-input ${className}`} />
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="label-caps !text-[10px]">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Search any column in the workspace. */
function ColumnPicker({ exclude, onPick, onClose, prefer }: {
  exclude: string; onPick: (id: string) => void; onClose: () => void; prefer: 'up' | 'down';
}) {
  const { graph } = useDE();
  const [q, setQ] = useState('');
  const self = graph.colById.get(exclude)!;
  const myLayer = LAYERS.findIndex((l) => l.id === self.table.layer);
  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const out: { id: string; label: string; layer: LayerId; score: number }[] = [];
    graph.colById.forEach(({ col, table }, id) => {
      if (id === exclude) return;
      const label = `${table.name}.${col.name}`;
      const l = label.toLowerCase();
      if (terms.length && !terms.every((t) => l.includes(t))) return;
      const li = LAYERS.findIndex((x) => x.id === table.layer);
      const dir = prefer === 'up' ? myLayer - li : li - myLayer;
      out.push({ id, label, layer: table.layer, score: (dir === 1 ? 0 : dir > 0 ? 1 : 3) + (col.name === self.col.name ? -1 : 0) });
    });
    return out.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label)).slice(0, 40);
  }, [q, graph, exclude, prefer, myLayer, self]);
  return (
    <div className="mt-2 rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-2 border-b border-border">
        <Search size={12} className="text-on-surface-variant" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search table.column…"
          className="flex-1 py-1.5 bg-transparent outline-none text-[12px] text-on-surface" />
        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface cursor-pointer"><X size={13} /></button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {results.map((r) => (
          <button key={r.id} onClick={() => onPick(r.id)} className="menu-item-de !rounded-none !py-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: layerMeta(r.layer).color }} />
            <span className="font-mono text-[11px] truncate">{r.label}</span>
          </button>
        ))}
        {!results.length && <div className="px-3 py-3 text-[11px] text-on-surface-variant">No match.</div>}
      </div>
    </div>
  );
}

function EdgeList({ edges, dir }: { edges: LineageEdge[]; dir: 'up' | 'down' }) {
  const { graph, select, removeEdge } = useDE();
  if (!edges.length) return <div className="text-[11.5px] text-on-surface-variant">{dir === 'up' ? 'No upstream link.' : 'Nothing downstream.'}</div>;
  return (
    <div className="space-y-1.5">
      {edges.map((e) => {
        const other = graph.colById.get(dir === 'up' ? e.from : e.to)!;
        const info = EDGE_INFO[e.kind];
        return (
          <div key={e.id} className="group flex items-start gap-2 rounded-lg p-2 bg-surface-container-low">
            <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: info.color }} />
            <div className="min-w-0 flex-1">
              <button onClick={() => select({ kind: 'column', id: other.col.id })}
                className="font-mono text-[11.5px] text-on-surface hover:text-primary text-left break-all cursor-pointer">
                {other.table.name}.<b>{other.col.name}</b>
              </button>
              <div className="text-[10.5px] text-on-surface-variant leading-snug mt-0.5">
                <span className="font-semibold" style={{ color: info.color }}>{info.label}</span> · {e.reason}
              </div>
              <div className="mt-1 h-1 rounded-full bg-surface-container overflow-hidden" title={`Confidence ${Math.round(e.confidence * 100)}%`}>
                <div className="h-full rounded-full" style={{ width: `${e.confidence * 100}%`, background: info.color }} />
              </div>
            </div>
            <button onClick={() => removeEdge(e)} title="Remove this link"
              className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error cursor-pointer shrink-0"><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}

function TablePanel({ id }: { id: string }) {
  const { graph, select, updateTable, deleteTable, addColumn, acceptPredictions } = useDE();
  const t = graph.tableById.get(id)!;
  const [q, setQ] = useState('');
  const [newCol, setNewCol] = useState('');
  const role = graph.roles.get(t.id) ?? 'reference';
  const ups = graph.tableEdges.filter((e) => e.to === t.id).sort((a, b) => b.count - a.count);
  const downs = graph.tableEdges.filter((e) => e.from === t.id).sort((a, b) => b.count - a.count);
  const k = columnCounts(graph, t);
  const cols = t.columns.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="px-4 py-4 border-b border-border" style={{ borderTop: `3px solid ${layerMeta(t.layer).color}` }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${ROLE_INFO[role].color}1a`, color: ROLE_INFO[role].color }}>{ROLE_INFO[role].label.toUpperCase()} TABLE</span>
          <select value={t.layer} onChange={(e) => updateTable(t.id, { layer: e.target.value as LayerId })}
            className="text-[11px] px-1.5 py-0.5 rounded border border-border bg-surface text-on-surface-variant" title="Move to another layer">
            {LAYERS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
        <EditText value={t.name} onCommit={(v) => v.trim() && updateTable(t.id, { name: v.trim() })} className="!text-[15px] !font-bold font-mono" />
        <div className="grid grid-cols-4 gap-1.5 mt-3 text-center">
          {[['carried', k.carried, '#0ea5e9'], ['calculated', k.calculated, '#8b5cf6'], ['lookups', k.lookups, '#10b981'], ['untraced', k.unknown, '#94a3b8']].map(([l, n, c]) => (
            <div key={l as string} className="rounded-lg bg-surface-container-low py-1.5">
              <div className="text-[15px] font-bold" style={{ color: c as string }}>{n as number}</div>
              <div className="text-[9.5px] text-on-surface-variant">{l as string}</div>
            </div>
          ))}
        </div>
      </div>

      {t.predicted && (
        <div className="px-4 py-3 border-b border-border bg-amber-400/10">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-on-surface"><Sparkles size={13} className="text-amber-500" /> Predicted table</div>
          <p className="text-[11.5px] text-on-surface-variant mt-1">{t.reason}</p>
          <div className="flex gap-1.5 mt-2">
            <button onClick={() => acceptPredictions(t.id)} className="btn-de-sm"><Check size={12} /> Accept</button>
            <button onClick={() => deleteTable(t.id)} className="btn-de-sm hover:!text-error"><Trash2 size={12} /> Discard</button>
          </div>
        </div>
      )}

      <Section title="In plain English">
        <ul className="space-y-1.5">
          {explainTable(graph, t).map((s, i) => (
            <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-on-surface"><Lightbulb size={12} className="text-amber-500 mt-1 shrink-0" />{s}</li>
          ))}
        </ul>
      </Section>

      <Section title="Description">
        <EditText multiline value={t.description} placeholder="What does one row of this table represent? Who uses it?" onCommit={(v) => updateTable(t.id, { description: v })} />
      </Section>

      <Section title={`Built from (${ups.length})`}>
        {ups.length ? ups.map((e) => {
          const o = graph.tableById.get(e.from)!;
          return (
            <button key={e.id} onClick={() => select({ kind: 'table', id: o.id })} className="menu-item-de !py-1">
              <ArrowUpLeft size={12} style={{ color: layerMeta(o.layer).color }} />
              <span className="font-mono text-[11.5px] truncate flex-1">{o.name}</span>
              <span className="text-[10.5px] text-on-surface-variant">{e.count} col{e.count > 1 ? 's' : ''}</span>
            </button>
          );
        }) : <div className="text-[11.5px] text-on-surface-variant">No upstream tables traced.</div>}
      </Section>

      <Section title={`Feeds (${downs.length})`}>
        {downs.length ? downs.map((e) => {
          const o = graph.tableById.get(e.to)!;
          return (
            <button key={e.id} onClick={() => select({ kind: 'table', id: o.id })} className="menu-item-de !py-1">
              <ArrowDownRight size={12} style={{ color: layerMeta(o.layer).color }} />
              <span className="font-mono text-[11.5px] truncate flex-1">{o.name}</span>
              <span className="text-[10.5px] text-on-surface-variant">{e.count} col{e.count > 1 ? 's' : ''}</span>
            </button>
          );
        }) : <div className="text-[11.5px] text-on-surface-variant">Nothing downstream yet.</div>}
      </Section>

      <Section title={`Columns (${t.columns.length})`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter columns…" className="de-input mb-2" />
        <div className="max-h-72 overflow-y-auto -mx-1">
          {cols.slice(0, 300).map((c) => (
            <button key={c.id} onClick={() => select({ kind: 'column', id: c.id })} className="menu-item-de !py-1">
              <span className="w-3 shrink-0">
                {c.key === 'PK' ? <KeyRound size={11} className="text-amber-500" /> : c.key === 'FK' ? <Link2 size={11} className="text-sky-500" /> : null}
              </span>
              <span className="font-mono text-[11.5px] truncate flex-1">{c.name}</span>
              {!graph.up.has(c.id) && t.layer !== 'source' && <span className="w-1.5 h-1.5 rounded-full border border-on-surface-variant/60" title="Untraced" />}
            </button>
          ))}
        </div>
        <form className="flex gap-1.5 mt-2" onSubmit={(e) => {
          e.preventDefault();
          if (!newCol.trim()) return;
          const id = addColumn(t.id, newCol.trim());
          setNewCol('');
          select({ kind: 'column', id });
        }}>
          <input value={newCol} onChange={(e) => setNewCol(e.target.value)} placeholder="new_column_name" className="de-input font-mono" />
          <button type="submit" className="btn-de-sm shrink-0"><Plus size={12} /> Add</button>
        </form>
      </Section>

      <div className="px-4 py-4">
        <button onClick={() => { if (window.confirm(`Delete table ${t.name}? You can undo this.`)) deleteTable(t.id); }}
          className="btn-de-sm hover:!text-error"><Trash2 size={12} /> Delete table</button>
      </div>
    </>
  );
}

function ColumnPanel({ id }: { id: string }) {
  const { graph, select, updateColumn, deleteColumn, addLink } = useDE();
  const r = graph.colById.get(id)!;
  const { col: c, table: t } = r;
  const [picking, setPicking] = useState<'up' | 'down' | null>(null);
  const [kind, setKind] = useState<EdgeKind>('map');
  const ups = graph.up.get(c.id) ?? [];
  const downs = graph.down.get(c.id) ?? [];
  const rel = (graph.relByCol.get(c.id) ?? []).find((x) => x.from === c.id);
  const raw = Object.entries(c.raw).filter(([, v]) => v);

  return (
    <>
      <div className="px-4 py-4 border-b border-border" style={{ borderTop: `3px solid ${layerMeta(t.layer).color}` }}>
        <button onClick={() => select({ kind: 'table', id: t.id })} className="text-[11px] font-mono text-on-surface-variant hover:text-primary cursor-pointer">
          {layerMeta(t.layer).label} · {t.name}
        </button>
        <EditText value={c.name} onCommit={(v) => v.trim() && updateColumn(c.id, { name: v.trim() })} className="!text-[15px] !font-bold font-mono mt-1" />
        {c.predicted && (
          <div className="mt-2 text-[11px] text-amber-600 flex items-start gap-1.5"><Sparkles size={12} className="mt-0.5 shrink-0" />
            Predicted ({Math.round((c.confidence ?? 0.5) * 100)}%): {c.reason}
          </div>
        )}
      </div>

      <Section title="In plain English">
        <ul className="space-y-1.5">
          {explainColumn(graph, c).map((s, i) => (
            <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-on-surface"><Lightbulb size={12} className="text-amber-500 mt-1 shrink-0" />{s}</li>
          ))}
        </ul>
      </Section>

      <Section title="Definition">
        <EditText multiline value={c.definition} placeholder="What does this column mean?" onCommit={(v) => updateColumn(c.id, { definition: v })} />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <label className="text-[10.5px] text-on-surface-variant">Data type
            <EditText value={c.dataType} placeholder="string" onCommit={(v) => updateColumn(c.id, { dataType: v })} className="mt-0.5" />
          </label>
          <label className="text-[10.5px] text-on-surface-variant">Key
            <select value={c.key} onChange={(e) => updateColumn(c.id, { key: e.target.value as KeyType })} className="de-input mt-0.5">
              <option value="">—</option><option value="PK">PK · primary key</option><option value="FK">FK · foreign key</option>
            </select>
          </label>
          <label className="text-[10.5px] text-on-surface-variant">Input / Derived
            <select value={c.origin} onChange={(e) => updateColumn(c.id, { origin: e.target.value as Origin })} className="de-input mt-0.5">
              <option value="">—</option><option value="Input">Input</option><option value="Derived">Derived</option>
            </select>
          </label>
          <label className="text-[10.5px] text-on-surface-variant flex items-end gap-2 pb-1.5">
            <input type="checkbox" checked={c.lookup} onChange={(e) => updateColumn(c.id, { lookup: e.target.checked })} /> Lookup column
          </label>
        </div>
        {t.layer === 'input' && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <label className="text-[10.5px] text-on-surface-variant">SOR table
              <EditText value={c.sourceTable} onCommit={(v) => updateColumn(c.id, { sourceTable: v })} className="mt-0.5 font-mono" />
            </label>
            <label className="text-[10.5px] text-on-surface-variant">SOR field
              <EditText value={c.sourceField} onCommit={(v) => updateColumn(c.id, { sourceField: v })} className="mt-0.5 font-mono" />
            </label>
          </div>
        )}
      </Section>

      <Section title={`Comes from (${ups.length})`} right={
        <button onClick={() => setPicking(picking === 'up' ? null : 'up')} className="btn-de-sm"><Plus size={11} /> Link</button>
      }>
        <EdgeList edges={ups} dir="up" />
        {picking === 'up' && (
          <>
            <div className="flex gap-1 mt-2">
              {(['map', 'calc', 'lookup', 'agg'] as EdgeKind[]).map((k) => (
                <button key={k} onClick={() => setKind(k)} className={`btn-de-sm ${kind === k ? 'btn-de-active' : ''}`}>{EDGE_INFO[k].label}</button>
              ))}
            </div>
            <ColumnPicker exclude={c.id} prefer="up" onClose={() => setPicking(null)}
              onPick={(from) => { addLink(from, c.id, kind); setPicking(null); }} />
          </>
        )}
      </Section>

      <Section title={`Used by (${downs.length})`} right={
        <button onClick={() => setPicking(picking === 'down' ? null : 'down')} className="btn-de-sm"><Plus size={11} /> Link</button>
      }>
        <EdgeList edges={downs} dir="down" />
        {picking === 'down' && (
          <ColumnPicker exclude={c.id} prefer="down" onClose={() => setPicking(null)}
            onPick={(to) => { addLink(c.id, to, 'map'); setPicking(null); }} />
        )}
      </Section>

      {rel && (
        <Section title="Relationship">
          <div className="text-[12px] text-on-surface">
            <span className="font-mono">{c.name}</span> → <button className="font-mono text-primary hover:underline cursor-pointer" onClick={() => select({ kind: 'column', id: rel.to })}>
              {graph.colById.get(rel.to)?.table.name}.{graph.colById.get(rel.to)?.col.name}
            </button>
            <div className="text-[11px] text-on-surface-variant mt-0.5">{rel.reason}</div>
          </div>
        </Section>
      )}

      {raw.length > 0 && (
        <Section title="Original CSV row">
          <div className="rounded-lg border border-border overflow-hidden">
            {raw.map(([k, v]) => (
              <div key={k} className="flex text-[11px] border-b border-border last:border-0">
                <span className="w-28 shrink-0 px-2 py-1 bg-surface-container-low text-on-surface-variant font-semibold truncate" title={k}>{k}</span>
                <span className="px-2 py-1 text-on-surface break-words min-w-0 select-text">{v}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="px-4 py-4">
        <button onClick={() => deleteColumn(c.id)} className="btn-de-sm hover:!text-error"><Trash2 size={12} /> Delete column</button>
      </div>
    </>
  );
}

function Overview() {
  const { graph, ws, addTable, select } = useDE();
  const [layer, setLayer] = useState<LayerId>('semantic');
  const [name, setName] = useState('');
  const cols = graph.tables.reduce((n, t) => n + t.columns.length, 0);
  return (
    <>
      <Section title="How to read the canvas">
        <ul className="space-y-2 text-[12px] text-on-surface leading-relaxed">
          <li>Each <b>lane</b> is a layer. Data flows left → right: {graph.layersPresent.map((l) => layerMeta(l).label.replace(' Layer', '')).join(' → ')}.</li>
          <li>Lines between tables show <b>how many columns</b> flow from one table to the next. Thicker = more.</li>
          <li><b>Hover</b> anything to learn about it: a column shows what it means and where it comes from, a table header shows what the table is, a line shows which columns travel along it.</li>
          <li><b>Click</b> a column to light up its full path, from source field to report.</li>
          <li><b>Zoom:</b> pinch on the trackpad, Ctrl + scroll, or the mouse wheel. <b>Move around:</b> two-finger swipe, or drag the background.</li>
          <li><b>Double-click</b> a table header (or ▾) to see every column, with a filter box.</li>
          <li>Switch to <b>Relationships</b> to see how tables join through primary and foreign keys.</li>
        </ul>
      </Section>
      <Section title="Legend">
        <div className="space-y-1.5">
          {Object.entries(EDGE_INFO).map(([k, e]) => (
            <div key={k} className="flex items-center gap-2 text-[11.5px] text-on-surface">
              <svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" stroke={e.color} strokeWidth="2.5" strokeDasharray={e.dash} /></svg>
              <span className="font-semibold w-28 shrink-0">{e.label}</span>
              <span className="text-on-surface-variant text-[10.5px] leading-snug">{e.explain}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-[11.5px] text-on-surface pt-1"><KeyRound size={12} className="text-amber-500" /> Primary key <Link2 size={12} className="text-sky-500 ml-3" /> Foreign key <span className="ml-3 font-bold text-violet-500">ƒ</span> calculated</div>
        </div>
      </Section>
      <Section title="This pipeline">
        <div className="text-[12px] text-on-surface">{graph.tables.length} tables · {cols} columns · {graph.edges.length} column links · {graph.relations.length} key relationships</div>
        {ws.tables.some((t) => t.predicted) && <div className="text-[11.5px] text-amber-600 mt-1">Contains predicted tables (dashed amber border).</div>}
      </Section>
      <Section title="Add a table">
        <form className="space-y-2" onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = addTable(layer, name.trim());
          setName('');
          select({ kind: 'table', id });
        }}>
          <select value={layer} onChange={(e) => setLayer(e.target.value as LayerId)} className="de-input">
            {LAYERS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <div className="flex gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="table_name" className="de-input font-mono" />
            <button type="submit" className="btn-de-sm shrink-0"><Plus size={12} /> Add</button>
          </div>
        </form>
      </Section>
    </>
  );
}

export default function Inspector({ onClose }: { onClose: () => void }) {
  const { selection, graph } = useDE();
  const valid = selection && (selection.kind === 'table' ? graph.tableById.has(selection.id) : graph.colById.has(selection.id));
  return (
    <div className="w-[360px] shrink-0 h-full border-l border-border bg-surface-container-lowest overflow-y-auto relative">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-container-lowest">
        <span className="label-caps">{!valid ? 'Overview' : selection!.kind === 'table' ? 'Table' : 'Column'}</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface-container text-on-surface-variant cursor-pointer" title="Hide panel"><X size={14} /></button>
      </div>
      {!valid ? <Overview /> : selection!.kind === 'table' ? <TablePanel key={selection!.id} id={selection!.id} /> : <ColumnPanel key={selection!.id} id={selection!.id} />}
    </div>
  );
}
