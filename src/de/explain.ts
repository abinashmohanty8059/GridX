import { Graph, LineageEdge } from './graph';
import { Column, layerMeta, Table, TableRole } from './types';

export const ROLE_INFO: Record<TableRole, { label: string; color: string; explain: string }> = {
  fact: { label: 'Fact', color: '#2563eb', explain: 'Records events or transactions (orders, payments, shifts). Usually long, with measures you add up.' },
  dimension: { label: 'Dimension', color: '#059669', explain: 'Describes things facts point to (a location, an employee, a menu item). Other tables join to it by its key.' },
  reference: { label: 'Reference', color: '#64748b', explain: 'Configuration or setup data (menus, tax rates, schedules). Rarely changes; mostly copied into other tables as lookups.' },
  bridge: { label: 'Bridge', color: '#9333ea', explain: 'Connects two tables in a many-to-many relationship. Mostly keys.' },
  aggregate: { label: 'Aggregate', color: '#d97706', explain: 'Pre-summarised numbers for reports (totals per day, per store…).' },
  source: { label: 'Source object', color: '#475569', explain: 'An object exactly as the source system returns it.' },
};

export const EDGE_INFO: Record<string, { label: string; color: string; dash?: string; explain: string }> = {
  map: { label: 'Carried over', color: '#0ea5e9', explain: 'The value is copied as-is from upstream (maybe renamed).' },
  calc: { label: 'Calculated', color: '#8b5cf6', dash: '6 4', explain: 'The value is computed from one or more upstream columns.' },
  lookup: { label: 'Lookup', color: '#10b981', dash: '2 4', explain: 'An id is swapped for a readable name from a reference table.' },
  agg: { label: 'Aggregated', color: '#f59e0b', dash: '10 4', explain: 'Rows are grouped and summed / counted.' },
  manual: { label: 'Manual link', color: '#ec4899', explain: 'A link you added by hand.' },
  fk: { label: 'Relationship (FK → PK)', color: '#94a3b8', dash: '4 3', explain: 'A foreign key in one table points at the primary key of another — this is how tables join.' },
};

const list = (xs: string[], max = 4) => {
  if (xs.length <= 1) return xs.join('');
  const shown = xs.slice(0, max);
  const rest = xs.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
};

export const grainOf = (t: Table) => {
  const pks = t.columns.filter((c) => c.key === 'PK').map((c) => c.name);
  return pks.length ? `one row per ${pks.join(' + ')}` : 'no primary key declared';
};

export function columnCounts(g: Graph, t: Table) {
  let carried = 0; let calculated = 0; let lookups = 0; let unknown = 0;
  for (const c of t.columns) {
    const ups = (g.up.get(c.id) ?? []);
    if (c.lookup || ups.some((e) => e.kind === 'lookup')) lookups++;
    else if (ups.some((e) => e.kind === 'calc' || e.kind === 'agg')) calculated++;
    else if (ups.length) carried++;
    else unknown++;
  }
  return { carried, calculated, lookups, unknown };
}

export function explainTable(g: Graph, t: Table): string[] {
  const role = g.roles.get(t.id) ?? 'reference';
  const lm = layerMeta(t.layer);
  const out: string[] = [];
  out.push(`${t.name} is a ${ROLE_INFO[role].label.toLowerCase()} table in the ${lm.label} with ${t.columns.length} columns — ${grainOf(t)}. ${ROLE_INFO[role].explain}`);
  if (t.predicted) out.push(`This table is a prediction. ${t.reason ?? ''} Review it, edit what is wrong, then accept it.`);

  const ups = g.tableEdges.filter((e) => e.to === t.id).sort((a, b) => b.count - a.count);
  const downs = g.tableEdges.filter((e) => e.from === t.id).sort((a, b) => b.count - a.count);
  if (ups.length) {
    out.push(`It is built from ${ups.length} upstream table${ups.length > 1 ? 's' : ''}: ${list(ups.map((e) => `${g.tableById.get(e.from)!.name} (${e.count} col${e.count > 1 ? 's' : ''})`), 5)}.`);
  } else if (t.layer !== 'source') {
    out.push('No upstream table could be traced for it yet — add links by hand if you know where it comes from.');
  }
  if (downs.length) {
    out.push(`It feeds ${list(downs.map((e) => `${g.tableById.get(e.to)!.name} (${e.count})`), 5)}.`);
  } else if (t.layer !== 'output') {
    out.push('Nothing downstream uses it yet.');
  }
  const k = columnCounts(g, t);
  if (t.layer !== 'source') {
    const parts = [];
    if (k.carried) parts.push(`${k.carried} carried over unchanged`);
    if (k.calculated) parts.push(`${k.calculated} calculated`);
    if (k.lookups) parts.push(`${k.lookups} lookups`);
    if (k.unknown) parts.push(`${k.unknown} with no traced source`);
    if (parts.length) out.push(`Of its columns, ${list(parts, 4)}.`);
  }
  const outRels = g.relations.filter((r) => r.fromTable === t.id);
  const inRels = g.relations.filter((r) => r.toTable === t.id);
  if (outRels.length) {
    const targets = [...new Set(outRels.map((r) => g.tableById.get(r.toTable)!.name))];
    out.push(`It joins out to ${list(targets, 5)} through foreign keys.`);
  }
  if (inRels.length) {
    const sources = [...new Set(inRels.map((r) => g.tableById.get(r.fromTable)!.name))];
    out.push(`${list(sources, 5)} point${sources.length === 1 ? 's' : ''} at it — join on ${g.colById.get(inRels[0].to)?.col.name}.`);
  }
  return out;
}

const ref = (g: Graph, id: string) => {
  const r = g.colById.get(id);
  return r ? `${r.table.name}.${r.col.name}` : '?';
};

/** Walk the main upstream path and describe each hop. */
export function upstreamStory(g: Graph, c: Column, depth = 6): string[] {
  const steps: string[] = [];
  let frontier: string[] = [c.id];
  const seen = new Set(frontier);
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      const ups = (g.up.get(id) ?? []).filter((e) => !seen.has(e.from));
      if (!ups.length) continue;
      const here = ref(g, id);
      const calc = ups.filter((e) => e.kind === 'calc' || e.kind === 'agg');
      if (calc.length) {
        steps.push(`${here} is ${calc[0].kind === 'agg' ? 'aggregated' : 'calculated'} from ${list(calc.map((e) => ref(g, e.from)), 5)}.`);
      } else {
        const e = ups[0];
        const r = g.colById.get(e.from)!;
        const verb = e.kind === 'lookup' ? 'looks up its value from'
          : r.table.layer === 'source' ? 'lands from the source field' : 'is carried over from';
        steps.push(`${here} ${verb} ${ref(g, e.from)}.`);
      }
      ups.forEach((e) => { seen.add(e.from); next.push(e.from); });
    }
    frontier = next.slice(0, 6);
  }
  return steps;
}

export function explainColumn(g: Graph, c: Column): string[] {
  const r = g.colById.get(c.id);
  if (!r) return [];
  const t = r.table;
  const out: string[] = [];
  const type = c.dataType ? ` (${c.dataType})` : '';
  out.push(`${c.name}${type} lives in ${t.name}, part of the ${layerMeta(t.layer).label}.`);
  if (c.key === 'PK') out.push('It is the primary key: every row has its own unique value, so it defines what one row means.');
  const rels = (g.relByCol.get(c.id) ?? []);
  const outRel = rels.find((x) => x.from === c.id);
  if (outRel) out.push(`It is a foreign key: it points at ${ref(g, outRel.to)} — ${outRel.reason.toLowerCase()}.`);
  const inRels = rels.filter((x) => x.to === c.id);
  if (inRels.length) out.push(`${inRels.length} column${inRels.length > 1 ? 's' : ''} in other tables point here (e.g. ${list(inRels.map((x) => ref(g, x.from)), 3)}).`);
  if (c.lookup) out.push('It is a lookup column: it shows a readable name instead of a code.');
  const story = upstreamStory(g, c);
  if (story.length) out.push(...story);
  else if (t.layer !== 'source') out.push('No upstream source was found for it. It may be added by the loading process, or you can link it by hand.');
  const downs = g.down.get(c.id) ?? [];
  if (downs.length) out.push(`It is used by ${list(downs.map((e) => ref(g, e.to)), 4)}.`);
  else if (t.layer !== 'output') out.push('No later layer uses it.');
  return out;
}

export const edgeLabel = (e: LineageEdge) => EDGE_INFO[e.kind]?.label ?? e.kind;

export const firstSentence = (s: string) => {
  const m = /^(.{15,}?[.!?])(\s|$)/.exec(s.trim());
  return (m ? m[1] : s).trim();
};

/** One line answering "what is this column, and where does it come from?" */
export function columnSummary(g: Graph, c: Column): string {
  const r = g.colById.get(c.id);
  if (!r) return '';
  const t = r.table;
  const ups = g.up.get(c.id) ?? [];
  const parts: string[] = [];
  if (c.key === 'PK') parts.push(`Identifies each row of ${t.name} (${grainOf(t)}).`);
  const rel = (g.relByCol.get(c.id) ?? []).find((x) => x.from === c.id);
  if (rel) parts.push(`Links to ${ref(g, rel.to)}.`);
  const calc = ups.filter((e) => e.kind === 'calc' || e.kind === 'agg');
  if (calc.length) parts.push(`Calculated from ${list(calc.map((e) => g.colById.get(e.from)?.col.name ?? '?'), 3)}.`);
  else if (c.lookup || ups.some((e) => e.kind === 'lookup')) parts.push(`A readable name looked up from ${ups[0] ? ref(g, ups[0].from) : 'a reference table'}.`);
  else if (ups.length) {
    const from = g.colById.get(ups[0].from)!;
    parts.push(from.table.layer === 'source' ? `Lands from source field ${from.col.name}.` : `Copied from ${ref(g, ups[0].from)}.`);
  } else if (t.layer !== 'source') parts.push('Where it comes from could not be traced.');
  return parts.join(' ');
}
