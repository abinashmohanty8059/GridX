import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, ChevronRight, GraduationCap, Route } from 'lucide-react';
import { useDE } from '../store';
import { Graph, nameTokens } from '../graph';
import { LayerId, layerMeta } from '../types';
import { upstreamStory } from '../explain';

const GLOSSARY: [string, string][] = [
  ['Layer', 'A stage of the pipeline. Each layer reads only from the layers before it, so problems can be traced backwards one step at a time.'],
  ['Lineage', 'The path a value takes from the source system to a report. Clicking a column on the canvas shows its lineage.'],
  ['Grain', 'What one row means — "one row per order" or "one row per payment". Mixing grains is the most common cause of double counting.'],
  ['Primary key (PK)', 'The column whose value is unique on every row. It defines the grain.'],
  ['Foreign key (FK)', 'A column holding another table\'s primary key. It is how two tables are joined.'],
  ['Fact table', 'Records events (orders, payments, shifts). Long, with numbers you add up.'],
  ['Dimension / reference', 'Describes things (locations, employees, menus). Facts point at them through foreign keys.'],
  ['Carried-over column', 'Copied as-is from an earlier layer, maybe renamed.'],
  ['Calculated column', 'Computed from other columns — a total, a flag, an hour of day. Usually prefixed drv_ here.'],
  ['Lookup column', 'Replaces an id with a readable name from a reference table, so reports don\'t need a join.'],
  ['Semantic model', 'The curated, business-friendly tables analysts actually query.'],
  ['Aggregation', 'Grouping rows (by day, by store) and summing or counting them — what output tables do.'],
];

interface Check { id: string; title: string; detail: string; tone: 'ok' | 'warn'; items: { label: string; sub?: string; kind: 'table' | 'column'; id: string }[] }

function runChecks(g: Graph): Check[] {
  const checks: Check[] = [];
  const layerCols = (l: LayerId) => g.tables.filter((t) => t.layer === l).flatMap((t) => t.columns.map((c) => ({ c, t })));

  // 1. Untraced columns
  for (const l of g.layersPresent) {
    if (l === 'source' || (l === 'input' && !g.layersPresent.includes('source'))) continue;
    const un = layerCols(l).filter(({ c }) => !g.up.has(c.id));
    const byT = new Map<string, number>();
    un.forEach(({ t }) => byT.set(t.id, (byT.get(t.id) ?? 0) + 1));
    checks.push({
      id: `untraced-${l}`, tone: un.length ? 'warn' : 'ok',
      title: `${layerMeta(l).label}: ${un.length ? `${un.length} columns with no traced source` : 'every column is traced'}`,
      detail: un.length ? 'These were not matched to an earlier layer by name, definition or explicit mapping. They may be added by the loader (e.g. extract source) — or link them by hand.' : 'Each column links back to an earlier layer.',
      items: [...byT.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, n]) => ({ label: g.tableById.get(id)!.name, sub: `${n} untraced`, kind: 'table', id })),
    });
  }

  // 2. Input tables nothing uses
  const downstreamExists = g.layersPresent.some((l) => l === 'derived' || l === 'semantic' || l === 'output');
  if (downstreamExists) {
    const unused = g.tables.filter((t) => t.layer === 'input' && !g.tableEdges.some((e) => e.from === t.id && g.tableById.get(e.to)?.layer !== 'input'));
    checks.push({
      id: 'unused-input', tone: unused.length ? 'warn' : 'ok',
      title: unused.length ? `${unused.length} input tables are not used by any later layer` : 'Every input table is used downstream',
      detail: 'Unused tables cost load time and confuse newcomers. Either they are genuinely unused, or a link is missing.',
      items: unused.slice(0, 20).map((t) => ({ label: t.name, sub: `${t.columns.length} cols`, kind: 'table', id: t.id })),
    });
  }

  // 3. Definitions that don't describe their column (often rows shifted in a spreadsheet)
  const mismatched: Check['items'] = [];
  for (const t of g.tables) {
    if (t.layer === 'source') continue;
    for (const c of t.columns) {
      if (!c.definition || c.definition.length < 25) continue;
      const toks = nameTokens(c.name, true).filter((x) => x.length > 2 && !['drv', 'the'].includes(x));
      if (toks.length < 2) continue;
      const def = c.definition.toLowerCase();
      const hit = toks.some((x) => def.includes(x.slice(0, Math.max(4, x.length - 2))));
      if (!hit) mismatched.push({ label: `${t.name}.${c.name}`, sub: c.definition.slice(0, 70), kind: 'column', id: c.id });
    }
  }
  checks.push({
    id: 'mismatch', tone: mismatched.length ? 'warn' : 'ok',
    title: mismatched.length ? `${mismatched.length} definitions don't mention anything in their column name` : 'Definitions match their column names',
    detail: 'When a definition shares no words with its column name, the definition is often attached to the wrong row. Worth a look.',
    items: mismatched.slice(0, 25),
  });

  // 4. Weak links
  const weak = g.edges.filter((e) => e.auto && e.confidence < 0.65);
  checks.push({
    id: 'weak', tone: weak.length ? 'warn' : 'ok',
    title: weak.length ? `${weak.length} links were inferred with low confidence` : 'All inferred links are confident',
    detail: 'Matched only by similar wording. Open them and confirm or remove the link.',
    items: weak.slice(0, 20).map((e) => {
      const b = g.colById.get(e.to)!; const a = g.colById.get(e.from)!;
      return { label: `${b.table.name}.${b.col.name}`, sub: `← ${a.table.name}.${a.col.name} (${Math.round(e.confidence * 100)}%)`, kind: 'column', id: b.col.id };
    }),
  });

  // 5. Missing definitions
  const nodef = g.tables.filter((t) => t.layer !== 'source').flatMap((t) => t.columns.filter((c) => !c.definition.trim()).map((c) => ({ c, t })));
  checks.push({
    id: 'nodef', tone: nodef.length ? 'warn' : 'ok',
    title: nodef.length ? `${nodef.length} columns have no definition` : 'Every column has a definition',
    detail: 'A column without a definition is a column nobody can use with confidence.',
    items: nodef.slice(0, 20).map(({ c, t }) => ({ label: `${t.name}.${c.name}`, kind: 'column', id: c.id })),
  });

  // 6. Tables without a primary key
  const nopk = g.tables.filter((t) => t.layer !== 'source' && t.layer !== 'output' && !t.columns.some((c) => c.key === 'PK'));
  checks.push({
    id: 'nopk', tone: nopk.length ? 'warn' : 'ok',
    title: nopk.length ? `${nopk.length} tables have no primary key` : 'Every table declares a primary key',
    detail: 'Without a primary key the grain is unclear, and joins can multiply rows.',
    items: nopk.slice(0, 20).map((t) => ({ label: t.name, kind: 'table', id: t.id })),
  });

  // 7. Foreign keys that point nowhere
  const dangling = g.tables.flatMap((t) => t.columns.filter((c) => c.key === 'FK' && !(g.relByCol.get(c.id) ?? []).some((r) => r.from === c.id)).map((c) => ({ c, t })));
  checks.push({
    id: 'dangling', tone: dangling.length ? 'warn' : 'ok',
    title: dangling.length ? `${dangling.length} foreign keys could not be matched to a table` : 'Every foreign key resolves',
    detail: 'The referenced table may not be in the files, or the key is named differently there.',
    items: dangling.slice(0, 20).map(({ c, t }) => ({ label: `${t.name}.${c.name}`, kind: 'column', id: c.id })),
  });
  return checks;
}

export default function InsightsView() {
  const { graph, focusColumn, focusTable, setView } = useDE();
  const [open, setOpen] = useState<string | null>(null);
  const checks = useMemo(() => runChecks(graph), [graph]);

  // A worked example: the most-travelled column in the last layer.
  const example = useMemo(() => {
    const last = [...graph.layersPresent].reverse().find((l) => l !== 'source');
    if (!last) return null;
    let best: { id: string; depth: number } | null = null;
    for (const t of graph.tables.filter((x) => x.layer === last)) {
      for (const c of t.columns) {
        const d = upstreamStory(graph, c).length;
        if (!best || d > best.depth || (d === best.depth && c.name.startsWith('drv_'))) best = { id: c.id, depth: d };
      }
    }
    const r = best ? graph.colById.get(best.id) : undefined;
    return r ? { r, story: upstreamStory(graph, r.col) } : null;
  }, [graph]);

  const flows = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of graph.edges) {
      const a = graph.colById.get(e.from)!.table.layer; const b = graph.colById.get(e.to)!.table.layer;
      if (a !== b) m.set(`${a}>${b}`, (m.get(`${a}>${b}`) ?? 0) + 1);
    }
    return m;
  }, [graph]);

  if (!graph.tables.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
        <BookOpen size={28} className="text-on-surface-variant" />
        <div className="text-on-surface font-semibold">Load a pipeline to see insights</div>
        <button onClick={() => setView('setup')} className="btn-de">Go to Pipeline Setup</button>
      </div>
    );
  }

  const layers = graph.layersPresent;
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        <div>
          <div className="label-caps">Insights & guide</div>
          <h2 className="text-2xl font-bold text-on-surface">How your data moves</h2>
          <p className="text-sm text-on-surface-variant mt-1">Read left to right. Each layer only reads from the ones before it.</p>
        </div>

        {/* Flow strip */}
        <div className="flex flex-wrap items-stretch gap-2">
          {layers.map((l, i) => {
            const m = layerMeta(l);
            const ts = graph.tables.filter((t) => t.layer === l);
            const cols = ts.reduce((n, t) => n + t.columns.length, 0);
            const traced = ts.reduce((n, t) => n + t.columns.filter((c) => graph.up.has(c.id)).length, 0);
            const next = layers[i + 1];
            return (
              <div key={l} className="flex items-stretch gap-2 flex-1 min-w-[180px]">
                <div className="glass-card !transform-none p-4 flex-1" style={{ borderTop: `3px solid ${m.color}` }}>
                  <div className="text-[10px] font-bold tracking-widest" style={{ color: m.color }}>{m.short}</div>
                  <div className="font-bold text-on-surface">{m.label}</div>
                  <div className="text-[11px] text-on-surface-variant mb-3">{m.tagline}</div>
                  <div className="text-2xl font-bold text-on-surface">{ts.length}<span className="text-sm font-medium text-on-surface-variant"> tables</span></div>
                  <div className="text-[12px] text-on-surface-variant">{cols.toLocaleString()} columns</div>
                  {l !== 'source' && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-surface-container overflow-hidden"><div className="h-full rounded-full" style={{ width: `${cols ? (traced / cols) * 100 : 0}%`, background: m.color }} /></div>
                      <div className="text-[10.5px] text-on-surface-variant mt-1">{cols ? Math.round((traced / cols) * 100) : 0}% traced upstream</div>
                    </div>
                  )}
                  {ts.some((t) => t.predicted) && <div className="text-[10.5px] text-amber-600 mt-1">includes predictions</div>}
                </div>
                {next && (
                  <div className="flex flex-col items-center justify-center text-on-surface-variant shrink-0 w-14">
                    <ArrowRight size={18} />
                    <span className="text-[10px] text-center leading-tight mt-1">{(flows.get(`${l}>${next}`) ?? 0).toLocaleString()} column links</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Layer explanations */}
        <div className="grid md:grid-cols-2 gap-4">
          {layers.map((l) => {
            const m = layerMeta(l);
            const sample = graph.tables.filter((t) => t.layer === l).slice(0, 4);
            return (
              <div key={l} className="glass-card !transform-none p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                  <span className="font-bold text-on-surface">{m.label}</span>
                </div>
                <p className="text-[12.5px] text-on-surface leading-relaxed">{m.explain}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {sample.map((t) => (
                    <button key={t.id} onClick={() => focusTable(t.id)} className="btn-de-sm font-mono">{t.name}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Worked example */}
        {example && example.story.length > 0 && (
          <div className="glass-card !transform-none p-6">
            <div className="flex items-center gap-2 mb-1"><Route size={16} className="text-violet-500" /><span className="font-bold text-on-surface">Follow one value through the pipeline</span></div>
            <p className="text-[12.5px] text-on-surface-variant mb-4">
              Here is the path of <b className="font-mono text-on-surface">{example.r.table.name}.{example.r.col.name}</b>, read from the end back to where it started.
            </p>
            <ol className="space-y-2">
              {example.story.map((s, i) => (
                <li key={i} className="flex gap-3 text-[12.5px] text-on-surface">
                  <span className="w-6 h-6 rounded-full bg-violet-500/15 text-violet-600 flex items-center justify-center text-[11px] font-bold shrink-0">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            <button onClick={() => focusColumn(example.r.col.id)} className="btn-de mt-4">See it on the canvas <ArrowRight size={13} /></button>
          </div>
        )}

        {/* Health checks */}
        <div>
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={16} className="text-amber-500" /><span className="font-bold text-on-surface">Health checks</span></div>
          <div className="space-y-2">
            {checks.map((c) => (
              <div key={c.id} className="glass-card !transform-none overflow-hidden">
                <button onClick={() => setOpen(open === c.id ? null : c.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer">
                  {c.tone === 'ok' ? <CheckCircle2 size={16} className="text-success shrink-0" /> : <AlertTriangle size={16} className="text-amber-500 shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-on-surface">{c.title}</span>
                    <span className="block text-[11.5px] text-on-surface-variant">{c.detail}</span>
                  </span>
                  {c.items.length > 0 && <ChevronRight size={16} className={`text-on-surface-variant transition-transform ${open === c.id ? 'rotate-90' : ''}`} />}
                </button>
                {open === c.id && c.items.length > 0 && (
                  <div className="px-4 pb-3 grid sm:grid-cols-2 gap-1">
                    {c.items.map((it) => (
                      <button key={it.id + it.label} onClick={() => (it.kind === 'table' ? focusTable(it.id) : focusColumn(it.id))} className="menu-item-de !py-1.5 !items-start">
                        <span className="min-w-0">
                          <span className="block font-mono text-[11.5px] truncate">{it.label}</span>
                          {it.sub && <span className="block text-[10.5px] text-on-surface-variant truncate">{it.sub}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Glossary */}
        <div>
          <div className="flex items-center gap-2 mb-3"><GraduationCap size={16} className="text-sky-500" /><span className="font-bold text-on-surface">Data engineering in plain words</span></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GLOSSARY.map(([term, def]) => (
              <div key={term} className="rounded-xl border border-border bg-surface-container-lowest p-4">
                <div className="font-semibold text-[13px] text-on-surface">{term}</div>
                <div className="text-[12px] text-on-surface-variant mt-1 leading-relaxed">{def}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
