import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpLeft, KeyRound, Link2, Sparkles } from 'lucide-react';
import { Graph } from '../graph';
import { layerMeta, LayerId } from '../types';
import { EDGE_INFO, ROLE_INFO, columnCounts, columnSummary, firstSentence, grainOf } from '../explain';
import { HoverState } from './canvasContext';

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function Card({ hover, accent, children }: { hover: HoverState; accent: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: hover.x + 18, top: hover.y + 14 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth; const h = el.offsetHeight;
    let left = hover.x + 18; let top = hover.y + 14;
    if (left + w > window.innerWidth - 12) left = hover.x - w - 18;
    if (top + h > window.innerHeight - 12) top = Math.max(12, window.innerHeight - h - 12);
    setPos({ left: Math.max(12, left), top });
  }, [hover.x, hover.y, hover.id]);
  return (
    <div ref={ref} className="fixed z-[60] w-[380px] glass-card-elevated !rounded-xl p-0 pointer-events-none text-[12px] overflow-hidden"
      style={{ left: pos.left, top: pos.top, borderTop: `3px solid ${accent}` }}>
      {children}
    </div>
  );
}

const LayerTag = ({ layer, name }: { layer: LayerId; name: string }) => {
  const lm = layerMeta(layer);
  return (
    <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
      <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: `${lm.color}22`, color: lm.color }}>{lm.short}</span>
      <span className="font-mono truncate">{name}</span>
    </div>
  );
};

const Summary = ({ text }: { text: string }) => (
  <div className="mt-2 rounded-lg px-3 py-2 text-[12.5px] leading-snug text-on-surface" style={{ background: 'color-mix(in srgb, var(--color-primary) 9%, transparent)' }}>
    {text}
  </div>
);

function ColumnCard({ hover, graph }: { hover: HoverState; graph: Graph }) {
  const r = graph.colById.get(hover.id);
  if (!r) return null;
  const { col: c, table: t } = r;
  const ups = graph.up.get(c.id) ?? [];
  const downs = graph.down.get(c.id) ?? [];
  const name = (id: string) => { const x = graph.colById.get(id); return x ? `${x.table.name}.${x.col.name}` : '?'; };
  const rawEntries = Object.entries(c.raw).filter(([, v]) => v !== '');
  const about = c.definition ? firstSentence(c.definition) : '';

  return (
    <Card hover={hover} accent={layerMeta(t.layer).color}>
      <div className="px-4 py-3 border-b border-border">
        <LayerTag layer={t.layer} name={t.name} />
        <div className="flex items-center gap-2 mt-1.5">
          {c.key === 'PK' && <KeyRound size={14} className="text-amber-500 shrink-0" />}
          {c.key === 'FK' && <Link2 size={14} className="text-sky-500 shrink-0" />}
          <span className="font-mono font-bold text-[14px] text-on-surface break-all">{c.name}</span>
        </div>
        {about && <p className="mt-1.5 text-[13px] leading-snug font-medium text-on-surface">{about}</p>}
        <Summary text={columnSummary(graph, c)} />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {c.dataType && <span className="chip-de">{c.dataType}</span>}
          {c.key && <span className="chip-de">{c.key === 'PK' ? 'Primary key' : 'Foreign key'}</span>}
          {c.origin && <span className="chip-de">{c.origin}</span>}
          {c.lookup && <span className="chip-de !text-emerald-600">Lookup</span>}
          {c.predicted && <span className="chip-de !text-amber-600"><Sparkles size={10} /> Predicted {c.confidence ? `· ${Math.round(c.confidence * 100)}%` : ''}</span>}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {c.definition && c.definition !== about && (
          <div>
            <div className="label-caps !text-[10px] mb-1">Full definition</div>
            <p className="text-on-surface leading-relaxed">{clip(c.definition, 500)}</p>
          </div>
        )}
        {!c.definition && <p className="text-on-surface-variant italic">No definition in the file.</p>}

        {ups.length > 0 && (
          <div>
            <div className="label-caps !text-[10px] mb-1 flex items-center gap-1"><ArrowUpLeft size={11} /> Comes from</div>
            {ups.slice(0, 3).map((e) => (
              <div key={e.id} className="flex items-start gap-2 mb-1">
                <span className="text-[9px] font-bold px-1 py-0.5 rounded shrink-0 mt-px" style={{ background: `${EDGE_INFO[e.kind].color}22`, color: EDGE_INFO[e.kind].color }}>{EDGE_INFO[e.kind].label}</span>
                <span className="font-mono text-on-surface break-all">{name(e.from)}</span>
              </div>
            ))}
            {ups.length > 3 && <div className="text-[10.5px] text-on-surface-variant">+{ups.length - 3} more</div>}
          </div>
        )}
        {downs.length > 0 && (
          <div>
            <div className="label-caps !text-[10px] mb-1 flex items-center gap-1"><ArrowDownRight size={11} /> Used by</div>
            <div className="font-mono text-on-surface break-all">{downs.slice(0, 3).map((e) => name(e.to)).join(', ')}{downs.length > 3 ? ` +${downs.length - 3} more` : ''}</div>
          </div>
        )}

        {rawEntries.length > 0 && (
          <div>
            <div className="label-caps !text-[10px] mb-1">From the CSV</div>
            <div className="rounded-lg border border-border overflow-hidden">
              {rawEntries.map(([k, v]) => (
                <div key={k} className="flex text-[10.5px] border-b border-border last:border-0">
                  <span className="w-28 shrink-0 px-2 py-1 bg-surface-container-low text-on-surface-variant font-semibold truncate" title={k}>{k}</span>
                  <span className="px-2 py-1 text-on-surface break-words min-w-0">{clip(v, 180)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="text-[10px] text-on-surface-variant">Click to trace it end to end and edit it.</div>
      </div>
    </Card>
  );
}

function TableCard({ hover, graph }: { hover: HoverState; graph: Graph }) {
  const t = graph.tableById.get(hover.id);
  if (!t) return null;
  const role = ROLE_INFO[graph.roles.get(t.id) ?? 'reference'];
  const ups = graph.tableEdges.filter((e) => e.to === t.id).sort((a, b) => b.count - a.count);
  const downs = graph.tableEdges.filter((e) => e.from === t.id).sort((a, b) => b.count - a.count);
  const k = columnCounts(graph, t);
  return (
    <Card hover={hover} accent={layerMeta(t.layer).color}>
      <div className="px-4 py-3 border-b border-border">
        <LayerTag layer={t.layer} name={layerMeta(t.layer).label} />
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-mono font-bold text-[14px] text-on-surface break-all flex-1">{t.name}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${role.color}1a`, color: role.color }}>{role.label.toUpperCase()}</span>
        </div>
        <Summary text={`${t.description ? firstSentence(t.description) + ' ' : ''}${role.explain} ${t.columns.length} columns, ${grainOf(t)}.`} />
      </div>
      <div className="px-4 py-3 space-y-3">
        {t.layer !== 'source' && (
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[['carried', k.carried, '#0ea5e9'], ['calculated', k.calculated, '#8b5cf6'], ['lookups', k.lookups, '#10b981'], ['untraced', k.unknown, '#94a3b8']].map(([l, n, c]) => (
              <div key={l as string} className="rounded-lg bg-surface-container-low py-1">
                <div className="text-[14px] font-bold" style={{ color: c as string }}>{n as number}</div>
                <div className="text-[9.5px] text-on-surface-variant">{l as string}</div>
              </div>
            ))}
          </div>
        )}
        {ups.length > 0 && (
          <div>
            <div className="label-caps !text-[10px] mb-1 flex items-center gap-1"><ArrowUpLeft size={11} /> Built from</div>
            <div className="text-on-surface">{ups.slice(0, 5).map((e) => `${graph.tableById.get(e.from)!.name} (${e.count})`).join(', ')}{ups.length > 5 ? ` +${ups.length - 5} more` : ''}</div>
          </div>
        )}
        {downs.length > 0 && (
          <div>
            <div className="label-caps !text-[10px] mb-1 flex items-center gap-1"><ArrowDownRight size={11} /> Feeds</div>
            <div className="text-on-surface">{downs.slice(0, 5).map((e) => `${graph.tableById.get(e.to)!.name} (${e.count})`).join(', ')}{downs.length > 5 ? ` +${downs.length - 5} more` : ''}</div>
          </div>
        )}
        <div className="text-[10px] text-on-surface-variant">Click to focus it · double-click to show every column.</div>
      </div>
    </Card>
  );
}

function EdgeCard({ hover, graph }: { hover: HoverState; graph: Graph }) {
  // A bundle of folded column lines explains the same as its table-to-table line.
  const id = hover.id.startsWith('cb:')
    ? (() => { const [a, , b] = hover.id.slice(3).split('|'); return `te:${a}>${b}`; })()
    : hover.id;
  // Table-to-table lineage line: list the columns travelling along it.
  if (id.startsWith('te:')) {
    const te = graph.tableEdges.find((e) => e.id === id);
    if (!te) return null;
    const a = graph.tableById.get(te.from)!; const b = graph.tableById.get(te.to)!;
    const cols = graph.edges.filter((e) => graph.colById.get(e.from)?.table.id === a.id && graph.colById.get(e.to)?.table.id === b.id);
    const byKind = new Map<string, number>();
    cols.forEach((e) => byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1));
    return (
      <Card hover={hover} accent={layerMeta(b.layer).color}>
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 font-mono font-bold text-[13px] text-on-surface flex-wrap">
            {a.name} <ArrowRight size={13} className="text-on-surface-variant" /> {b.name}
          </div>
          <Summary text={`${te.count} column${te.count > 1 ? 's' : ''} of ${b.name} come${te.count === 1 ? 's' : ''} from ${a.name} (${layerMeta(a.layer).label} → ${layerMeta(b.layer).label}).`} />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[...byKind.entries()].map(([k, n]) => (
              <span key={k} className="chip-de" style={{ color: EDGE_INFO[k].color }}>{n} {EDGE_INFO[k].label.toLowerCase()}</span>
            ))}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="label-caps !text-[10px] mb-1.5">Columns on this line</div>
          <div className="space-y-1">
            {cols.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface">
                <span className="truncate">{graph.colById.get(e.from)!.col.name}</span>
                <ArrowRight size={11} className="shrink-0" style={{ color: EDGE_INFO[e.kind].color }} />
                <span className="truncate font-semibold">{graph.colById.get(e.to)!.col.name}</span>
              </div>
            ))}
            {cols.length > 10 && <div className="text-[10.5px] text-on-surface-variant">+{cols.length - 10} more — click a table to see them all</div>}
          </div>
        </div>
      </Card>
    );
  }
  // Key relationship (aggregated pair or a single FK)
  if (id.startsWith('rel:') || id.startsWith('r:')) {
    const rels = id.startsWith('rel:')
      ? (() => { const [f, to] = id.slice(4).split('>'); return graph.relations.filter((r) => r.fromTable === f && r.toTable === to); })()
      : graph.relations.filter((r) => r.id === id);
    if (!rels.length) return null;
    const a = graph.tableById.get(rels[0].fromTable)!; const b = graph.tableById.get(rels[0].toTable)!;
    const fk = graph.colById.get(rels[0].from)!.col; const pk = graph.colById.get(rels[0].to)!.col;
    return (
      <Card hover={hover} accent="#64748b">
        <div className="px-4 py-3">
          <div className="label-caps !text-[10px]">Relationship</div>
          <div className="flex items-center gap-2 font-mono font-bold text-[13px] text-on-surface mt-1 flex-wrap">
            {a.name}.{fk.name} <ArrowRight size={13} className="text-on-surface-variant" /> {b.name}.{pk.name}
          </div>
          <Summary text={`Each row of ${a.name} points at one row of ${b.name} through ${fk.name}. Join them on ${fk.name} = ${pk.name}.`} />
          <div className="text-[11px] text-on-surface-variant mt-2">{rels[0].reason}{rels.length > 1 ? ` · ${rels.length} keys link these tables` : ''}</div>
        </div>
      </Card>
    );
  }
  // Column-level lineage line
  const e = graph.edges.find((x) => x.id === id);
  if (!e) return null;
  const a = graph.colById.get(e.from)!; const b = graph.colById.get(e.to)!;
  const info = EDGE_INFO[e.kind];
  return (
    <Card hover={hover} accent={info.color}>
      <div className="px-4 py-3">
        <div className="text-[10px] font-bold" style={{ color: info.color }}>{info.label.toUpperCase()}</div>
        <div className="font-mono text-[12px] text-on-surface mt-1 break-all">{a.table.name}.<b>{a.col.name}</b></div>
        <div className="font-mono text-[12px] text-on-surface break-all">→ {b.table.name}.<b>{b.col.name}</b></div>
        <Summary text={`${info.explain} ${e.reason}.`} />
        <div className="text-[10.5px] text-on-surface-variant mt-2">Confidence {Math.round(e.confidence * 100)}%</div>
      </div>
    </Card>
  );
}

export default function HoverCard({ hover, graph }: { hover: HoverState; graph: Graph }) {
  if (hover.kind === 'column') return <ColumnCard hover={hover} graph={graph} />;
  if (hover.kind === 'table') return <TableCard hover={hover} graph={graph} />;
  return <EdgeCard hover={hover} graph={graph} />;
}
