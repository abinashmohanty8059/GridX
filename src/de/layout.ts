import { Graph } from './graph';
import { Column, LayerId, LAYER_ORDER, Table, TableRole } from './types';

export const NODE_W = 300;
export const LANE_GAP = 230;
export const ROW_H = 24;
export const HEADER_H = 60;
export const FOOTER_H = 28;
export const FILTER_H = 34;
export const GAP_Y = 28;
export const LANE_TOP = 110;   // room for the lane header
export const LANE_PAD = 40;

export interface NodeView {
  table: Table;
  visible: Column[];
  hidden: number;
  expanded: boolean;
  height: number;
}

export interface ViewOptions {
  expanded: boolean;
  limit: number;
  filter: string;
  pinned: Set<string>;
  compact: boolean;   // crowded lanes show keys only until expanded
}

const COLLAPSED_ROWS = 5;
export const WRAP_AT = 20;   // lanes with more tables wrap into sub-columns
const PER_SUBCOL = 18;
const SUB_GAP = 50;

/** Which columns a node shows: keys and traced columns always, the rest on demand. */
export function computeView(t: Table, o: ViewOptions): NodeView {
  let visible: Column[];
  if (o.expanded) {
    const f = o.filter.trim().toLowerCase();
    const matches = f ? t.columns.filter((c) => c.name.toLowerCase().includes(f) || c.definition.toLowerCase().includes(f)) : t.columns;
    visible = matches.slice(0, o.limit);
    const shown = new Set(visible.map((c) => c.id));
    for (const c of t.columns) if (o.pinned.has(c.id) && !shown.has(c.id)) visible.push(c);
  } else if (t.columns.length <= (o.compact ? 2 : COLLAPSED_ROWS + 1)) {
    visible = t.columns;
  } else {
    const rows = o.compact ? 1 : COLLAPSED_ROWS;
    const keys = t.columns.filter((c) => c.key === 'PK').concat(t.columns.filter((c) => c.key === 'FK').slice(0, 3));
    const pinned = t.columns.filter((c) => o.pinned.has(c.id));
    // Traced columns take the place of filler rows so the node keeps its height.
    const pick = new Set([...pinned, ...keys].slice(0, Math.max(rows, pinned.length)).map((c) => c.id));
    for (const c of t.columns) { if (pick.size >= rows) break; pick.add(c.id); }
    visible = t.columns.filter((c) => pick.has(c.id));
  }
  const hidden = t.columns.length - visible.length;
  const height = HEADER_H + (o.expanded ? FILTER_H : 0) + visible.length * ROW_H + (hidden > 0 || o.expanded ? FOOTER_H : 10);
  return { table: t, visible, hidden, expanded: o.expanded, height };
}

const ROLE_RANK: Record<TableRole, number> = { fact: 0, aggregate: 0, source: 0, bridge: 1, dimension: 2, reference: 3 };

export interface LaneBox { layer: LayerId; x: number; y: number; width: number; height: number }

export type LayoutPreset = 'lr' | 'tb' | 'grid';
export type Spacing = 'tight' | 'normal' | 'roomy';

export interface LayoutOptions {
  orientation: 'LR' | 'TB';
  wrapAt: number;   // lanes with more tables than this wrap
  perSub: number;   // tables per sub-column (or sub-row)
  spacing: number;  // gap multiplier
}

export const LAYOUT_PRESETS: Record<LayoutPreset, { label: string; hint: string; opts: Omit<LayoutOptions, 'spacing'> }> = {
  lr: { label: 'Left → right', hint: 'Layers as columns, data flows to the right', opts: { orientation: 'LR', wrapAt: WRAP_AT, perSub: PER_SUBCOL } },
  tb: { label: 'Top → bottom', hint: 'Layers as rows, data flows downwards', opts: { orientation: 'TB', wrapAt: 8, perSub: 8 } },
  grid: { label: 'Compact grid', hint: 'Every layer wrapped into short columns so it all fits on screen', opts: { orientation: 'LR', wrapAt: 6, perSub: 6 } },
};

export const SPACING: Record<Spacing, number> = { tight: 0.55, normal: 1, roomy: 1.7 };

export function layoutCanvas(
  g: Graph, views: Map<string, NodeView>, lanes: LayerId[],
  opts: LayoutOptions = { ...LAYOUT_PRESETS.lr.opts, spacing: 1 },
): { pos: Map<string, { x: number; y: number }>; laneBoxes: LaneBox[] } {
  const byLane: Table[][] = lanes.map((l) => g.tables.filter((t) => t.layer === l && views.has(t.id)));
  // Every layer hidden (or filtered empty): nothing to place.
  if (!byLane.some((ts) => ts.length)) return { pos: new Map(), laneBoxes: [] };
  const laneOf = new Map<string, number>();
  byLane.forEach((ts, i) => ts.forEach((t) => laneOf.set(t.id, i)));

  // Neighbours across adjacent lanes, weighted by how many columns flow between them.
  const nbr = new Map<string, { id: string; w: number }[]>();
  const link = (a: string, b: string, w: number) => {
    (nbr.get(a) ?? nbr.set(a, []).get(a)!).push({ id: b, w });
  };
  for (const e of g.tableEdges) {
    if (!laneOf.has(e.from) || !laneOf.has(e.to) || laneOf.get(e.from) === laneOf.get(e.to)) continue;
    const w = Math.log2(1 + e.count);
    link(e.from, e.to, w); link(e.to, e.from, w);
  }

  // Initial order: facts first, then bigger tables.
  for (const ts of byLane) {
    ts.sort((a, b) => (ROLE_RANK[g.roles.get(a.id) ?? 'reference'] - ROLE_RANK[g.roles.get(b.id) ?? 'reference'])
      || b.columns.length - a.columns.length || a.name.localeCompare(b.name));
  }

  // Barycenter sweeps to reduce crossings.
  const index = new Map<string, number>();
  const reindex = () => byLane.forEach((ts) => ts.forEach((t, i) => index.set(t.id, i / Math.max(1, ts.length - 1))));
  reindex();
  const sweep = (li: number, refLane: number) => {
    const ts = byLane[li];
    const score = new Map<string, number>();
    ts.forEach((t, i) => {
      const ns = (nbr.get(t.id) ?? []).filter((n) => laneOf.get(n.id) === refLane);
      const tw = ns.reduce((s, n) => s + n.w, 0);
      score.set(t.id, tw ? ns.reduce((s, n) => s + index.get(n.id)! * n.w, 0) / tw : 2 + i / ts.length);
    });
    ts.sort((a, b) => score.get(a.id)! - score.get(b.id)!);
    reindex();
  };
  for (let it = 0; it < 4; it++) {
    for (let li = 1; li < byLane.length; li++) sweep(li, li - 1);
    for (let li = byLane.length - 2; li >= 0; li--) sweep(li, li + 1);
  }

  // Crowded lanes wrap into sub-columns (sub-rows when flowing top → bottom).
  // Tables that feed the next lane go in the sub-column nearest to it so their
  // lines don't cross the others.
  const tb = opts.orientation === 'TB';
  const subcols: Table[][][] = byLane.map((ts, li) => {
    if (ts.length <= opts.wrapAt) return [ts];
    const k = Math.ceil(ts.length / opts.perSub);
    const flowOut = (t: Table) => (nbr.get(t.id) ?? []).filter((n) => laneOf.get(n.id)! > li).reduce((s, n) => s + n.w, 0);
    const ranked = [...ts].sort((a, b) => flowOut(b) - flowOut(a));
    const per = Math.ceil(ts.length / k);
    const cols: Table[][] = [];
    for (let c = 0; c < k; c++) {
      cols.unshift(ranked.slice(c * per, (c + 1) * per).sort((a, b) => index.get(a.id)! - index.get(b.id)!));
    }
    return cols;
  });

  // Work in (primary, secondary) axes: primary runs across the lanes, secondary
  // stacks tables inside a lane. Left → right: primary = x. Top → bottom: primary = y.
  const gap = GAP_Y * opts.spacing;
  const laneGap = LANE_GAP * opts.spacing;
  const subGap = SUB_GAP * opts.spacing;
  const h = (t: Table) => views.get(t.id)!.height;
  const prim = (t: Table) => (tb ? h(t) : NODE_W);
  const sec = (t: Table) => (tb ? NODE_W : h(t));
  const headPrim = tb ? LANE_TOP : 0;
  const headSec = tb ? 0 : LANE_TOP;
  const subThick = (ts: Table[]) => ts.reduce((m, t) => Math.max(m, prim(t)), tb ? 0 : NODE_W);
  const laneThick = (li: number) => subcols[li].reduce((s, ts) => s + subThick(ts), 0) + (subcols[li].length - 1) * subGap;
  const laneStart: number[] = [];
  byLane.forEach((_, li) => laneStart.push(li === 0 ? 0 : laneStart[li - 1] + headPrim + laneThick(li - 1) + laneGap));

  const at = new Map<string, { p: number; s: number }>();
  const colLen = (ts: Table[]) => ts.reduce((s, t) => s + sec(t) + gap, 0);
  const laneLen = (li: number) => Math.max(...subcols[li].map(colLen));
  let anchor = 0;
  byLane.forEach((_, li) => { if (laneLen(li) > laneLen(anchor)) anchor = li; });
  const place = (li: number, refs: number[]) => {
    let p = laneStart[li] + headPrim;
    subcols[li].forEach((ts) => {
      let end = headSec;
      for (const t of ts) {
        let desired = end;
        if (refs.length) {
          const ns = (nbr.get(t.id) ?? []).filter((n) => refs.includes(laneOf.get(n.id)!) && at.has(n.id));
          const tw = ns.reduce((s, n) => s + n.w, 0);
          if (tw) {
            const centre = ns.reduce((s, n) => s + (at.get(n.id)!.s + sec(g.tableById.get(n.id)!) / 2) * n.w, 0) / tw;
            desired = centre - sec(t) / 2;
          }
        }
        const s = Math.max(end, desired);
        at.set(t.id, { p, s });
        end = s + sec(t) + gap;
      }
      p += subThick(ts) + subGap;
    });
  };
  place(anchor, []);
  for (let li = anchor + 1; li < byLane.length; li++) place(li, [li - 1]);
  for (let li = anchor - 1; li >= 0; li--) place(li, [li + 1]);

  const pos = new Map<string, { x: number; y: number }>();
  at.forEach(({ p, s }, id) => pos.set(id, tb ? { x: s, y: p } : { x: p, y: s }));

  const laneBoxes: LaneBox[] = byLane.map((ts, li) => {
    const far = ts.reduce((m, t) => Math.max(m, at.get(t.id)!.s + sec(t)), headSec + 120);
    const thick = headPrim + laneThick(li);
    return tb
      ? { layer: lanes[li], x: -LANE_PAD, y: laneStart[li] - LANE_PAD / 2, width: far + LANE_PAD * 2, height: thick + LANE_PAD }
      : { layer: lanes[li], x: laneStart[li] - LANE_PAD, y: 0, width: thick + LANE_PAD * 2, height: far + LANE_PAD };
  });
  return { pos, laneBoxes };
}

export const lanesFor = (g: Graph, hidden: Set<LayerId>) => LAYER_ORDER.filter((l) => g.layersPresent.includes(l) && !hidden.has(l));
