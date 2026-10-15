import {
  Column, EdgeKind, LayerId, LAYER_ORDER, Table, TableRole, Workspace, layerIndex,
} from './types';

// ─── Graph types ─────────────────────────────────────────────────────────────

export interface LineageEdge {
  id: string;
  from: string;        // upstream column id
  to: string;          // downstream column id
  kind: EdgeKind;
  reason: string;
  confidence: number;  // 0..1
  auto: boolean;       // computed (true) or stored link (false)
}

export interface Relation {
  id: string;
  from: string;        // FK column id
  to: string;          // referenced (PK) column id
  fromTable: string;
  toTable: string;
  reason: string;
  confidence: number;
}

export interface TableEdge {
  id: string;
  from: string;
  to: string;
  count: number;
  kinds: EdgeKind[];
  confidence: number;
}

export interface ColRef { col: Column; table: Table }

export interface Graph {
  tables: Table[];
  tableById: Map<string, Table>;
  colById: Map<string, ColRef>;
  edges: LineageEdge[];
  up: Map<string, LineageEdge[]>;
  down: Map<string, LineageEdge[]>;
  relations: Relation[];
  relByCol: Map<string, Relation[]>;
  tableEdges: TableEdge[];
  roles: Map<string, TableRole>;
  layersPresent: LayerId[];
}

// ─── Text helpers ────────────────────────────────────────────────────────────

const STOP = new Set(('the a an of to in on at for and or is are was be by as it its this that with from ' +
  'not no so if when which what who than then there their these those has have had into only also any ' +
  'all each every per can may one two such rather where while use used using row rows column value values ' +
  'record records table data field').split(' '));

const LAYER_PREFIX = /^(in|inp|drv|der|sem|out|src|stg|raw|dim|fct|fact|rpt|vw|cfg|tbl)_/i;

export const singular = (t: string) =>
  t.length > 3 && t.endsWith('ies') ? `${t.slice(0, -3)}y`
    : t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t;

/** "in_configServicePeriod" → ["config","service","period"] */
export function nameTokens(name: string, stripPrefix = false): string[] {
  const base = stripPrefix ? name.replace(LAYER_PREFIX, '') : name;
  return base
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((t) => singular(t.toLowerCase()))
    .filter((t) => t && !/^\d+$/.test(t));
}

const defTokenCache = new WeakMap<Column, Set<string>>();
function defTokens(c: Column): Set<string> {
  let s = defTokenCache.get(c);
  if (!s) {
    s = new Set(
      c.definition.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(singular),
    );
    defTokenCache.set(c, s);
  }
  return s;
}

const jaccard = (a: Iterable<string>, b: Iterable<string>) => {
  const A = new Set(a); const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let i = 0; A.forEach((x) => { if (B.has(x)) i++; });
  return i / (A.size + B.size - i);
};

/** Overlap coefficient; tolerant of one definition extending the other. */
const containment = (A: Set<string>, B: Set<string>) => {
  if (A.size < 4 || B.size < 4) return 0;
  let i = 0; A.forEach((x) => { if (B.has(x)) i++; });
  return i / Math.min(A.size, B.size);
};

const lc = (s: string) => s.toLowerCase();
const normSorTable = (s: string) => lc(s).replace(/^cfg\./, 'config.');

/** Dotted or snake_case identifiers mentioned in a definition. */
function refTokens(def: string): string[] {
  const out = new Set<string>();
  const re = /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+|[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+/g;
  for (const m of def.matchAll(re)) out.add(m[0].replace(/[._]+$/, ''));
  return [...out];
}

// ─── Indexes over a layer ────────────────────────────────────────────────────

interface LayerIndex {
  layer: LayerId;
  tables: Table[];
  byName: Map<string, ColRef[]>;
  bySorField: Map<string, ColRef[]>;
  tableByName: Map<string, Table[]>; // table name, or the SOR object it lands
  byToken: Map<string, ColRef[]>;
}

function indexLayer(layer: LayerId, tables: Table[]): LayerIndex {
  const ix: LayerIndex = { layer, tables, byName: new Map(), bySorField: new Map(), tableByName: new Map(), byToken: new Map() };
  const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); };
  for (const t of tables) {
    push(ix.tableByName, lc(t.name), t);
    const sorTables = new Set<string>();
    for (const c of t.columns) {
      const ref = { col: c, table: t };
      push(ix.byName, lc(c.name), ref);
      if (c.sourceField) push(ix.bySorField, lc(c.sourceField), ref);
      if (c.sourceTable) sorTables.add(normSorTable(c.sourceTable));
      for (const tok of new Set(nameTokens(c.name))) push(ix.byToken, tok, ref);
    }
    sorTables.forEach((s) => { if (!ix.tableByName.get(s)?.includes(t)) push(ix.tableByName, s, t); });
  }
  return ix;
}

/** Resolve a table mention (in_order, DRV_order, config.diningOptions…) */
function resolveTableMention(ix: LayerIndex, token: string): Table[] {
  const t = lc(token);
  return ix.tableByName.get(normSorTable(t)) ?? ix.tableByName.get(t) ?? [];
}

// ─── Matching one layer onto the layer(s) upstream of it ─────────────────────

interface Candidate { ref: ColRef; kind: EdgeKind; reason: string; confidence: number }

function tableAffinity(target: Table, ups: LayerIndex): Map<string, number> {
  const score = new Map<string, number>();
  for (const c of target.columns) {
    const cands = ups.byName.get(lc(c.name));
    if (!cands) continue;
    const w = 1 / cands.length; // rarer shared names are stronger evidence
    for (const r of cands) score.set(r.table.id, (score.get(r.table.id) ?? 0) + 1 + w * 4);
  }
  const stem = nameTokens(target.name, true);
  for (const t of ups.tables) {
    const sim = jaccard(stem, nameTokens(t.name, true));
    if (sim > 0) score.set(t.id, (score.get(t.id) ?? 0) + sim * 25);
  }
  return score;
}

function matchColumn(
  col: Column, table: Table, ups: LayerIndex[], affinity: Map<string, number>[], siblings: Map<string, Column>,
): Candidate[] {
  const def = col.definition;
  // "…matched on order.restaurantService.guid" names a join key, not the source.
  const refs = def ? refTokens(def.replace(/\b(?:matched|joined|keyed|linked)\s+on\b[^,;]*/gi, '')) : [];
  const best = (li: number, cands: ColRef[]) =>
    cands.reduce((a, b) => ((affinity[li].get(b.table.id) ?? 0) > (affinity[li].get(a.table.id) ?? 0) ? b : a));

  // Tables the definition points at, per upstream layer ("Copied in from config.diningOptions")
  const mentioned = ups.map((ix) => {
    const s = new Set<string>();
    for (const r of refs) {
      const parts = r.split('.');
      for (let n = parts.length; n >= 1; n--) {
        const hits = resolveTableMention(ix, parts.slice(0, n).join('.'));
        if (hits.length) { hits.forEach((t) => s.add(t.id)); break; }
      }
    }
    return s;
  });

  // a) explicit upstream mapping on the row (non-input layers)
  if (col.sourceField && table.layer !== 'input') {
    for (const ix of ups) {
      const st = col.sourceTable ? resolveTableMention(ix, col.sourceTable) : ix.tables;
      for (const t of st) {
        const c = t.columns.find((x) => lc(x.name) === lc(col.sourceField) || lc(x.sourceField) === lc(col.sourceField));
        if (c) return [{ ref: { col: c, table: t }, kind: 'map', reason: `Mapped explicitly to ${t.name}.${c.name}`, confidence: 1 }];
      }
    }
  }

  // b) same column name upstream (nearest layer first)
  for (let li = 0; li < ups.length; li++) {
    const same = ups[li].byName.get(lc(col.name));
    if (!same?.length) continue;
    const inMentioned = same.filter((r) => mentioned[li].has(r.table.id));
    const b = best(li, inMentioned.length ? inMentioned : same);
    const why = same.length === 1
      ? `Same column name in ${b.table.name}`
      : inMentioned.length
        ? `Same name; the definition says it comes from ${b.table.name}`
        : `Same name exists in ${same.length} tables — ${b.table.name} shares the most columns with ${table.name}`;
    return [{ ref: b, kind: col.lookup ? 'lookup' : 'map', reason: why, confidence: same.length === 1 || inMentioned.length ? 0.95 : 0.8 }];
  }

  // Fuzzy search over a pool of upstream columns (name + definition similarity)
  const ctoks = nameTokens(col.name, true).filter((t) => t !== 'drv');
  const myDef = defTokens(col);
  const myNum = /_(\d+)$/.exec(col.name)?.[1];
  const fuzzy =(li: number, onlyMentioned: boolean, threshold: number): Candidate[] => {
    const ix = ups[li];
    const pool = new Map<string, ColRef>();
    for (const t of ix.tables) if (mentioned[li].has(t.id)) for (const c of t.columns) pool.set(c.id, { col: c, table: t });
    if (!onlyMentioned) {
      for (const tok of ctoks) {
        const hits = ix.byToken.get(tok);
        if (hits && hits.length < 250) hits.forEach((h) => pool.set(h.col.id, h));
      }
    }
    let top: { ref: ColRef; score: number } | null = null;
    pool.forEach((ref) => {
      const nt = nameTokens(ref.col.name, true);
      const nameSim = Math.max(jaccard(ctoks, nt), jaccard(ctoks, [...nt, ...nameTokens(ref.table.name, true)]));
      const defSim = containment(myDef, defTokens(ref.col));
      // Numbered siblings (scopes_1 … scopes_13) must agree on their number.
      const rn = /_(\d+)$/.exec(ref.col.name)?.[1];
      const numAdj = myNum === rn ? (myNum ? 0.1 : 0) : (myNum || rn ? -0.3 : 0);
      const score = 0.45 * nameSim + 0.4 * defSim + (mentioned[li].has(ref.table.id) ? 0.15 : 0) + numAdj;
      if (!top || score > top.score) top = { ref, score };
    });
    const tp = top as { ref: ColRef; score: number } | null;
    if (!tp || tp.score < threshold) return [];
    return [{
      ref: tp.ref, kind: col.lookup ? 'lookup' : 'map', confidence: Math.min(0.9, tp.score + 0.1),
      reason: mentioned[li].has(tp.ref.table.id)
        ? `Definition says it is copied from ${tp.ref.table.name}; closest column by name and meaning is ${tp.ref.col.name}`
        : `Similar name and definition to ${tp.ref.table.name}.${tp.ref.col.name}`,
    }];
  };

  // c) "Copied in from <object>": search that object's columns first
  if (/copied in from|looked up (?:dynamically )?from|taken from|pulled from|sourced from/i.test(def)) {
    for (let li = 0; li < ups.length; li++) {
      if (!mentioned[li].size) continue;
      const hit = fuzzy(li, true, 0.3);
      if (hit.length) return hit;
    }
  }

  // d) columns / fields named inside the definition → calculation inputs
  const found: Candidate[] = [];
  const seen = new Set<string>([col.id]);
  const add = (r: ColRef, why: string, conf: number) => {
    if (seen.has(r.col.id)) return;
    seen.add(r.col.id);
    found.push({ ref: r, kind: 'calc', reason: why, confidence: conf });
  };
  for (const tok of refs) {
    // DRV_order.openedDate → order.openedDate
    const parts = tok.split('.').map((p, i) => (i === 0 ? p.replace(LAYER_PREFIX, '') : p));
    if (parts.length === 1) {
      const s = siblings.get(lc(tok)) ?? siblings.get(`drv_${lc(tok)}`);
      if (s) { add({ col: s, table }, `Calculated from ${s.name} in the same table`, 0.75); continue; }
    }
    let hit = false;
    for (let li = 0; li < ups.length && !hit; li++) {
      // SOR field: whole token, then drop leading segments (DRV_order.openedDate → order.openedDate)
      for (let s = 0; s < parts.length - 1 && !hit; s++) {
        const f = parts.slice(s).join('.');
        const hits = ups[li].bySorField.get(lc(f));
        if (hits?.length) {
          const b = best(li, hits);
          // Prefer the copy already sitting on this row, if the table carries one.
          const s2 = siblings.get(lc(b.col.name));
          if (s2 && s2.id !== col.id) add({ col: s2, table }, `Calculated from ${s2.name} (= ${f}) on the same row`, 0.75);
          else add(b, `Definition references ${f}`, 0.75);
          hit = true;
        }
      }
      if (!hit && parts.length === 1) {
        const hits = ups[li].byName.get(lc(tok));
        if (hits?.length) { add(best(li, hits), `Definition references ${tok}`, 0.7); hit = true; }
      }
    }
  }
  if (found.length) {
    const carried = /copied in from|carbon copy|no transformation/i.test(def) && found.length === 1;
    return found.slice(0, 8).map((f) => ({ ...f, kind: carried ? 'map' : 'calc' }));
  }

  // e) fuzzy over the whole upstream layer
  for (let li = 0; li < ups.length; li++) {
    const hit = fuzzy(li, false, 0.5);
    if (hit.length) return hit;
  }
  return [];
}

// ─── Relationships (PK ← FK) inside one layer ────────────────────────────────

function buildRelations(ix: LayerIndex, sorIx: LayerIndex | null): Relation[] {
  const rels: Relation[] = [];
  const pkTables = ix.tables.filter((t) => t.columns.some((c) => c.key === 'PK'));
  const pkByName = new Map<string, ColRef[]>();
  for (const t of pkTables) for (const c of t.columns) {
    if (c.key !== 'PK') continue;
    // "menu_group_id | menu_category_id" style composite names
    for (const n of c.name.split(/\s*\|\s*/)) {
      const a = pkByName.get(lc(n)); const r = { col: c, table: t };
      if (a) a.push(r); else pkByName.set(lc(n), [r]);
    }
  }
  for (const t of ix.tables) {
    for (const c of t.columns) {
      const isRefLike = c.key === 'FK' || (c.key !== 'PK' && /(_id|_guid|Id)$/.test(c.name));
      if (!isRefLike) continue;
      const toks = nameTokens(c.name).filter((x) => x !== 'id' && x !== 'guid');
      let target: ColRef | null = null; let reason = ''; let conf = 0;

      const same = (pkByName.get(lc(c.name)) ?? []).filter((r) => r.table.id !== t.id);
      if (same.length) {
        target = same.reduce((a, b) => (jaccard(toks, nameTokens(b.table.name, true)) > jaccard(toks, nameTokens(a.table.name, true)) ? b : a));
        reason = `${c.name} is the primary key of ${target.table.name}`; conf = 0.95;
      }
      if (!target && c.definition) {
        // "It resolves against labor.employees" / "looked up in config.diningOptions"
        for (const tok of refTokens(c.definition)) {
          const hits = resolveTableMention(ix, tok).length ? resolveTableMention(ix, tok)
            : sorIx ? resolveTableMention(sorIx, tok) : [];
          const tt = hits.find((h) => h.layer === t.layer && h.id !== t.id && h.columns.some((x) => x.key === 'PK'));
          if (tt) {
            target = { col: tt.columns.find((x) => x.key === 'PK')!, table: tt };
            reason = `Definition says ${c.name} resolves against ${tok}`; conf = 0.85; break;
          }
        }
      }
      if (!target && toks.length) {
        let best: { r: ColRef; s: number } | null = null;
        for (const pt of pkTables) {
          if (pt.id === t.id) continue;
          const s = jaccard(toks, nameTokens(pt.name, true));
          if (s >= 0.5 && (!best || s > best.s)) best = { r: { col: pt.columns.find((x) => x.key === 'PK')!, table: pt }, s };
        }
        if (best) { target = best.r; reason = `${c.name} names the ${best.r.table.name} table`; conf = 0.55 + best.s * 0.3; }
      }
      if (target) {
        rels.push({ id: `r:${c.id}>${target.col.id}`, from: c.id, to: target.col.id, fromTable: t.id, toTable: target.table.id, reason, confidence: conf });
      }
    }
  }
  return rels;
}

// ─── Roles ───────────────────────────────────────────────────────────────────

const REF_WORDS = /config|cfg|menu|schedule|lookup|setting|reason|categor|printer|drawer|station|packaging|partner|metadata|xref|option|type|location|restaurant|group|job/i;

function inferRole(t: Table, relsIn: number, relsOut: number): TableRole {
  if (t.layer === 'source') return 'source';
  if (t.layer === 'output') return 'aggregate';
  const measures = t.columns.filter((c) => /amount|total|sales|price|qty|quantity|count|hours|tax|tip|discount|refund|wage|pay\b/i.test(c.name)).length;
  const stem = t.name.replace(LAYER_PREFIX, '');
  if (/^(config|cfg|menus?|lookup|ref)/i.test(stem)) return relsIn > 0 ? 'dimension' : 'reference';
  if (REF_WORDS.test(stem) && measures < 4) return relsIn > 0 ? 'dimension' : 'reference';
  if (relsIn > relsOut && measures < 3) return 'dimension';
  if (relsOut >= 2 && t.columns.length <= 6 && measures === 0) return 'bridge';
  return measures > 0 || relsOut > 0 ? 'fact' : 'reference';
}

// ─── Build ───────────────────────────────────────────────────────────────────

export function buildGraph(ws: Workspace): Graph {
  const tables = ws.tables.filter((t) => ws.showSource || t.layer !== 'source');
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const colById = new Map<string, ColRef>();
  for (const t of tables) for (const c of t.columns) colById.set(c.id, { col: c, table: t });

  const byLayer = new Map<LayerId, Table[]>();
  for (const t of tables) { const a = byLayer.get(t.layer); if (a) a.push(t); else byLayer.set(t.layer, [t]); }
  const layersPresent = LAYER_ORDER.filter((l) => byLayer.has(l));
  const ixs = new Map<LayerId, LayerIndex>();
  layersPresent.forEach((l) => ixs.set(l, indexLayer(l, byLayer.get(l)!)));

  const suppressed = new Set(ws.suppressed);
  const edges: LineageEdge[] = [];
  const pushEdge = (e: LineageEdge) => { if (!suppressed.has(`${e.from}>${e.to}`)) edges.push(e); };

  // Source → Input: explicit SOR mapping
  const srcIx = ixs.get('source');
  if (srcIx) {
    const key = new Map<string, Column>();
    for (const t of srcIx.tables) for (const c of t.columns) key.set(`${lc(t.name)}|${lc(c.name)}`, c);
    for (const t of byLayer.get('input') ?? []) for (const c of t.columns) {
      const s = key.get(`${lc(c.sourceTable)}|${lc(c.sourceField)}`);
      if (s) pushEdge({ id: `e:${s.id}>${c.id}`, from: s.id, to: c.id, kind: 'map', reason: `Landed from ${c.sourceTable} · ${c.sourceField}`, confidence: 1, auto: true });
    }
  }

  // Every later layer matches onto the nearest earlier layers (source excluded).
  const flowLayers = layersPresent.filter((l) => l !== 'source');
  for (let i = 1; i < flowLayers.length; i++) {
    const layer = flowLayers[i];
    const ups = flowLayers.slice(0, i).reverse().map((l) => ixs.get(l)!);
    for (const t of byLayer.get(layer)!) {
      const affinity = ups.map((u) => tableAffinity(t, u));
      const siblings = new Map(t.columns.map((c) => [lc(c.name), c]));
      for (const c of t.columns) {
        if (c.predicted) continue; // predicted columns carry their own links
        for (const m of matchColumn(c, t, ups, affinity, siblings)) {
          pushEdge({ id: `e:${m.ref.col.id}>${c.id}`, from: m.ref.col.id, to: c.id, kind: m.kind, reason: m.reason, confidence: m.confidence, auto: true });
        }
      }
    }
  }

  // Stored links (manual + predicted)
  for (const l of ws.links) {
    if (!colById.has(l.from) || !colById.has(l.to)) continue;
    edges.push({ id: l.id, from: l.from, to: l.to, kind: l.kind, reason: l.reason, confidence: l.predicted ? 0.7 : 1, auto: false });
  }

  const up = new Map<string, LineageEdge[]>();
  const down = new Map<string, LineageEdge[]>();
  for (const e of edges) {
    (up.get(e.to) ?? up.set(e.to, []).get(e.to)!).push(e);
    (down.get(e.from) ?? down.set(e.from, []).get(e.from)!).push(e);
  }

  // Relationships
  const relations: Relation[] = [];
  for (const l of layersPresent) {
    if (l === 'source') continue;
    relations.push(...buildRelations(ixs.get(l)!, l === 'input' ? srcIx ?? null : null));
  }
  const relByCol = new Map<string, Relation[]>();
  for (const r of relations) {
    (relByCol.get(r.from) ?? relByCol.set(r.from, []).get(r.from)!).push(r);
    (relByCol.get(r.to) ?? relByCol.set(r.to, []).get(r.to)!).push(r);
  }

  // Table-level lineage
  const te = new Map<string, TableEdge & { conf: number }>();
  for (const e of edges) {
    const a = colById.get(e.from)!.table; const b = colById.get(e.to)!.table;
    if (a.id === b.id) continue;
    const k = `${a.id}>${b.id}`;
    let x = te.get(k);
    if (!x) { x = { id: `te:${k}`, from: a.id, to: b.id, count: 0, kinds: [], confidence: 0, conf: 0 }; te.set(k, x); }
    x.count++; x.conf += e.confidence;
    if (!x.kinds.includes(e.kind)) x.kinds.push(e.kind);
  }
  const tableEdges = [...te.values()].map(({ conf, ...x }) => ({ ...x, confidence: conf / x.count }));

  const relIn = new Map<string, number>(); const relOut = new Map<string, number>();
  for (const r of relations) {
    relIn.set(r.toTable, (relIn.get(r.toTable) ?? 0) + 1);
    relOut.set(r.fromTable, (relOut.get(r.fromTable) ?? 0) + 1);
  }
  const roles = new Map(tables.map((t) => [t.id, inferRole(t, relIn.get(t.id) ?? 0, relOut.get(t.id) ?? 0)]));

  return { tables, tableById, colById, edges, up, down, relations, relByCol, tableEdges, roles, layersPresent };
}

// ─── Traversal ───────────────────────────────────────────────────────────────

export interface Trace {
  cols: Map<string, number>;   // column id → signed depth (negative = upstream)
  edges: Set<string>;
  tables: Set<string>;
}

export function traceColumn(g: Graph, colId: string, maxDepth = 12): Trace {
  const cols = new Map<string, number>([[colId, 0]]);
  const edges = new Set<string>();
  const walk = (dir: 'up' | 'down') => {
    let frontier = [colId];
    for (let d = 1; d <= maxDepth && frontier.length; d++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const e of (dir === 'up' ? g.up : g.down).get(id) ?? []) {
          edges.add(e.id);
          const other = dir === 'up' ? e.from : e.to;
          if (!cols.has(other)) { cols.set(other, dir === 'up' ? -d : d); next.push(other); }
        }
      }
      frontier = next;
    }
  };
  walk('up'); walk('down');
  const tables = new Set<string>();
  cols.forEach((_, id) => { const r = g.colById.get(id); if (r) tables.add(r.table.id); });
  return { cols, edges, tables };
}

export function traceTable(g: Graph, tableId: string) {
  const ups = g.tableEdges.filter((e) => e.to === tableId);
  const downs = g.tableEdges.filter((e) => e.from === tableId);
  return { ups, downs };
}

export const isUpstreamLayer = (a: LayerId, b: LayerId) => layerIndex(a) < layerIndex(b);
