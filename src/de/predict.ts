import { Graph, nameTokens } from './graph';
import { Column, LayerId, StoredLink, Table, Workspace, uid } from './types';

// ─── Shared heuristics ───────────────────────────────────────────────────────

const NOISE_DEF = /no useful information|carries no analytical|exists only to make|in this data it is empty|same (?:word|value)? ?on every row|never populated|is not licensed|always empty/i;
const NOISE_NAME = /entity_type$|external_id$|_external_|array_index|_json$|scopes?_\d+$|_ref$|_xref|pricing_features|_guid_\d+$/i;
const MEASURE = /amount|total|sales|price|qty|quantity|count|hours|tax|tip|discount|refund|wage|pay$|_pay_|gratuity|charge|cost|revenue|duration/i;
const LABEL = /(^|_)(name|title|label|email|source|behavior|behaviour|type|category|channel|option|code|status|reason)$/i;
const ADMIN = /deleted|modified|created|device|version|sync|snapshot|_by_|timezone|time_zone|epoch|iso_/i;

const firstSentence = (s: string) => {
  const m = /^(.{20,}?[.!?])(\s|$)/.exec(s.trim());
  return (m ? m[1] : s).trim();
};

const stemOf = (name: string) => name.replace(/^(in|inp|drv|der|sem|out|src|stg|raw|dim|fct|fact)_/i, '');
const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

export interface Prediction { tables: Table[]; links: StoredLink[] }

function baseLayer(g: Graph, prefer: LayerId[]): LayerId | null {
  return prefer.find((l) => g.layersPresent.includes(l)) ?? null;
}

// ─── Semantic layer ──────────────────────────────────────────────────────────

interface Scored { col: Column; score: number; why: string[]; lookup: boolean }

function scoreColumn(c: Column, t: Table, g: Graph, factIds: Set<string>, idStems: Set<string>): Scored {
  const n = c.name.toLowerCase();
  const why: string[] = [];
  let s = 0;
  let lookup = false;
  const entity = nameTokens(stemOf(t.name))[0] ?? '';
  if (c.key === 'PK' || n === `${entity}_id`) return { col: c, score: 1.2, why: ['identifies one row of this table (its grain)'], lookup };
  if (NOISE_DEF.test(c.definition) || NOISE_NAME.test(n)) return { col: c, score: -1, why: ['technical / empty field'], lookup };

  if (n.startsWith('drv_')) { s += 0.5; why.push('calculated business field'); }
  if (MEASURE.test(n) && !/_id$/.test(n)) { s += 0.4; why.push('a measure you can add up'); }
  if (/business_date/.test(n)) { s += 0.6; why.push('the business date reports filter on'); }
  else if (/_date$/.test(n)) { s += 0.3; why.push('a date to filter by'); }
  if (/hour|day_of_week/.test(n)) { s += 0.3; why.push('time-of-day breakdown'); }
  if (/minute|second|_year_|month/.test(n)) s -= 0.25;
  if (LABEL.test(n)) { s += 0.3; why.push('readable label for grouping'); }
  if (/^is_|_flag$|counted/.test(n)) { s += /void|deleted|refund/.test(n) ? 0.45 : 0.3; why.push('yes/no filter'); }
  if (entity && n.startsWith(`${entity}_`)) { s += 0.3; why.push(`core attribute of the ${entity}`); }
  if (/count|guest|quantity/.test(n)) s += 0.1;

  // Foreign keys to other fact tables keep the semantic tables joinable.
  const rel = (g.relByCol.get(c.id) ?? []).find((r) => r.from === c.id);
  if (rel && factIds.has(rel.toTable)) { s += 0.7; why.push(`joins to ${g.tableById.get(rel.toTable)?.name}`); }
  else if (/_id$|_guid$/.test(n)) s -= 0.4;

  if (/_at$/.test(n)) s += /opened|paid|closed|clock/.test(n) ? 0.15 : -0.15;
  if (ADMIN.test(n)) s -= 0.35;

  // Columns copied in from configuration tables: keep readable labels as lookups, drop the rest.
  const up = (g.up.get(c.id) ?? []).map((e) => g.colById.get(e.from)?.table).filter(Boolean) as Table[];
  const fromRef = !(entity && n.startsWith(`${entity}_`)) && up.some((u) => ['reference', 'dimension'].includes(g.roles.get(u.id) ?? ''));
  if (fromRef) {
    // A label is worth keeping when the row also carries the id it describes
    // (dining_option_id → dining_option_name); otherwise it is just a copied config field.
    const stem = n.replace(/^drv_/, '').replace(/_(name|title|label|email|behavior|type|code|first_name|last_name|job_title)$/, '');
    const paired = [...idStems].some((x) => x === stem || stem.startsWith(`${x}_`) || x.startsWith(`${stem}_`));
    if (LABEL.test(n) && !ADMIN.test(n) && paired) { lookup = true; s += 0.35; why.push(`lookup: turns an id on this row into a readable name (from ${up[0].name})`); }
    else s -= 0.45;
  }
  return { col: c, score: s, why, lookup };
}

export function predictSemantic(ws: Workspace, g: Graph): Prediction {
  const base = baseLayer(g, ['derived', 'input']);
  if (!base) return { tables: [], links: [] };
  const existing = new Set(ws.tables.filter((t) => t.layer === 'semantic').map((t) => t.name.toLowerCase()));
  const facts = g.tables.filter((t) => t.layer === base && g.roles.get(t.id) === 'fact');
  const factIds = new Set(facts.map((t) => t.id));
  const tables: Table[] = [];
  const links: StoredLink[] = [];

  for (const src of facts) {
    const idStems = new Set(src.columns.filter((c) => /_(id|guid)$/i.test(c.name)).map((c) => c.name.toLowerCase().replace(/_(id|guid)$/, '').replace(/^drv_/, '')));
    const scored = src.columns.map((c) => scoreColumn(c, src, g, factIds, idStems))
      .filter((x) => x.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 45);
    if (scored.length < 5) continue;
    const name = `sem_${snake(stemOf(src.name))}`;
    if (existing.has(name)) continue;
    const pk = src.columns.find((c) => c.key === 'PK');
    // Keep the original column order so the table reads naturally.
    const order = new Map(src.columns.map((c, i) => [c.id, i]));
    scored.sort((a, b) => order.get(a.col.id)! - order.get(b.col.id)!);

    const t: Table = {
      id: uid('t'), name, layer: 'semantic', predicted: true,
      confidence: Math.min(0.9, 0.4 + scored.length / 60),
      reason: `Built from ${src.name}: kept ${scored.length} of ${src.columns.length} columns that look business-relevant.`,
      description: `Predicted business table${pk ? ` at the grain of one row per ${pk.name}` : ''}. Curated from ${src.name}, keeping keys, dates, measures and readable labels and dropping technical fields.`,
      columns: [],
    };
    for (const s of scored) {
      const derived = s.col.name.toLowerCase().startsWith('drv_') || (g.up.get(s.col.id) ?? []).some((e) => e.kind === 'calc');
      const c: Column = {
        id: uid('c'), name: s.col.name, dataType: s.col.dataType, key: s.col.key,
        definition: (s.lookup ? 'Look Up: ' : '') + firstSentence(s.col.definition || `Carried from ${src.name}.${s.col.name}.`),
        origin: derived ? 'Derived' : 'Input', lookup: s.lookup, sourceTable: src.name, sourceField: s.col.name,
        raw: { 'Predicted from': `${src.name}.${s.col.name}`, Why: s.why.join('; ') || 'general business field', Score: s.score.toFixed(2) },
        predicted: true, confidence: Math.max(0.3, Math.min(0.95, 0.4 + s.score / 2)),
        reason: s.why.join('; ') || 'general business field',
      };
      t.columns.push(c);
      links.push({ id: uid('l'), from: s.col.id, to: c.id, kind: s.lookup ? 'lookup' : 'map', reason: `Predicted: ${c.reason}`, predicted: true });
    }
    tables.push(t);
  }
  return { tables, links };
}

// ─── Output layer ────────────────────────────────────────────────────────────

const isNumericType = (c: Column) => /int|dec|num|money|float|double|flag|0\/1/i.test(c.dataType);

export function predictOutput(ws: Workspace, g: Graph): Prediction {
  const base = baseLayer(g, ['semantic', 'derived', 'input']);
  if (!base) return { tables: [], links: [] };
  const existing = new Set(ws.tables.filter((t) => t.layer === 'output').map((t) => t.name.toLowerCase()));
  const tables: Table[] = [];
  const links: StoredLink[] = [];

  for (const src of g.tables.filter((t) => t.layer === base && (base === 'semantic' || g.roles.get(t.id) === 'fact'))) {
    const cols = src.columns;
    const date = cols.find((c) => /business_date/i.test(c.name)) ?? cols.find((c) => /_date$/i.test(c.name));
    const location = cols.find((c) => /location_name|store_name/i.test(c.name)) ?? cols.find((c) => /location|store/i.test(c.name) && !/_id$/i.test(c.name));
    const pk = cols.find((c) => c.key === 'PK');
    const counted = cols.find((c) => /counted/i.test(c.name));
    const measures = cols.filter((c) =>
      c !== counted && c.key === '' && MEASURE.test(c.name) && !/_id$|_date$|_at$|name$/i.test(c.name)
      && (isNumericType(c) || c.name.toLowerCase().startsWith('drv_')))
      .slice(0, 10);
    const cats = cols.filter((c) => c !== location && c.key === '' && (c.lookup || LABEL.test(c.name)) && !/_id$|email/i.test(c.name)).slice(0, 2);
    if (!date || (!measures.length && !pk)) continue;

    const stem = snake(stemOf(src.name)).replace(/_header$/, '');
    const entity = nameTokens(stem).slice(-1)[0] ?? 'row';

    const make = (name: string, dims: Column[], meas: Column[], purpose: string): Table | null => {
      if (existing.has(name)) return null;
      const t: Table = {
        id: uid('t'), name, layer: 'output', predicted: true, confidence: 0.6,
        reason: purpose,
        description: `${purpose} One row per ${dims.map((d) => d.name).join(' × ')}.`,
        columns: [],
      };
      const add = (c: Omit<Column, 'id' | 'raw' | 'origin' | 'lookup' | 'predicted'>, from: Column[], agg: string) => {
        const col: Column = {
          ...c, id: uid('c'), origin: 'Derived', lookup: false, predicted: true,
          raw: { Aggregation: agg, 'Source table': src.name, 'Source columns': from.map((f) => f.name).join(', ') },
        };
        t.columns.push(col);
        from.forEach((f) => links.push({ id: uid('l'), from: f.id, to: col.id, kind: agg === 'GROUP BY' ? 'map' : 'agg', reason: `${agg} of ${src.name}.${f.name}`, predicted: true }));
      };
      for (const d of dims) {
        add({ name: d.name, dataType: d.dataType, key: 'PK', definition: `Grouping column: ${firstSentence(d.definition || d.name)}`, sourceTable: src.name, sourceField: d.name, reason: 'dimension', confidence: 0.8 }, [d], 'GROUP BY');
      }
      if (counted) add({ name: `${entity}_count`, dataType: 'Integer', key: '', definition: `Number of real ${entity}s — the sum of ${counted.name}.`, sourceTable: src.name, sourceField: counted.name, reason: 'count measure', confidence: 0.8 }, [counted], 'SUM');
      else if (pk) add({ name: `${entity}_count`, dataType: 'Integer', key: '', definition: `Number of distinct ${pk.name} values.`, sourceTable: src.name, sourceField: pk.name, reason: 'count measure', confidence: 0.7 }, [pk], 'COUNT DISTINCT');
      for (const m of meas) {
        const nm = `total_${m.name.replace(/^drv_/i, '').replace(/_total$|^total_/i, '')}`;
        add({ name: nm, dataType: m.dataType || 'Decimal', key: '', definition: `Sum of ${m.name}: ${firstSentence(m.definition || m.name)}`, sourceTable: src.name, sourceField: m.name, reason: 'summed measure', confidence: 0.7 }, [m], 'SUM');
      }
      // Ratios that almost every report asks for.
      const net = meas.find((m) => /net_sales/i.test(m.name));
      const gross = meas.find((m) => /gross_sales$/i.test(m.name));
      const disc = meas.find((m) => /discount_amount/i.test(m.name));
      const countSrc = counted ?? pk;
      if (net && countSrc) add({ name: `average_${entity}_value`, dataType: 'Decimal (money)', key: '', definition: `Net sales divided by the number of ${entity}s — the average spend per ${entity}.`, sourceTable: src.name, sourceField: net.name, reason: 'ratio KPI', confidence: 0.6 }, [net, countSrc], 'RATIO');
      if (gross && disc) add({ name: 'discount_rate', dataType: 'Decimal (percent)', key: '', definition: 'Discounts as a share of gross sales.', sourceTable: src.name, sourceField: disc.name, reason: 'ratio KPI', confidence: 0.6 }, [disc, gross], 'RATIO');
      return t.columns.length > dims.length ? t : null;
    };

    const daily = make(`out_${stem}_daily${location ? '_by_location' : ''}`, [date, ...(location ? [location] : [])], measures, `Daily ${stem.replace(/_/g, ' ')} totals${location ? ' per location' : ''} — the typical dashboard feed.`);
    if (daily) tables.push(daily);
    if (cats[0]) {
      const catName = cats[0].name.replace(/^drv_/i, '').replace(/_name$/i, '');
      const by = make(`out_${stem}_by_${catName}`, [date, cats[0]], measures.slice(0, 5), `${stem.replace(/_/g, ' ')} split by ${cats[0].name} — shows the mix across ${catName.replace(/_/g, ' ')}s.`);
      if (by) tables.push(by);
    }
  }
  return { tables, links };
}
