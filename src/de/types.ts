// ─── Data Engineering workspace model ────────────────────────────────────────
// Everything the canvas, catalog and inspector show is derived from a
// `Workspace`. Ids are stable uids so renames never break lineage links.

export type LayerId = 'source' | 'input' | 'derived' | 'semantic' | 'output';

export interface LayerMeta {
  id: LayerId;
  label: string;
  short: string;
  color: string;      // accent used for lane, badges and edges
  soft: string;       // translucent fill for lane backgrounds
  tagline: string;
  explain: string;    // plain-English explanation for newcomers
}

export const LAYERS: LayerMeta[] = [
  {
    id: 'source', label: 'Source System', short: 'SRC', color: '#64748b', soft: 'rgba(100,116,139,0.07)',
    tagline: 'Where the data is born',
    explain: 'The operational system (for example a POS or ERP API). Its objects and fields are named the way the vendor names them, often nested like order.checks.payments.amount. We never change data here — we only read it.',
  },
  {
    id: 'input', label: 'Input Layer', short: 'IN', color: '#0ea5e9', soft: 'rgba(14,165,233,0.07)',
    tagline: 'Raw data, landed and renamed',
    explain: 'A faithful copy of the source, flattened into tables with clean snake_case names. No business logic yet: one input table per source object, one column per source field. If something looks wrong later, this is the layer you check against.',
  },
  {
    id: 'derived', label: 'Derived Layer', short: 'DRV', color: '#8b5cf6', soft: 'rgba(139,92,246,0.07)',
    tagline: 'Joined, cleaned and calculated',
    explain: 'Input tables are joined together (lookups copied in so you never need a join later) and new columns are calculated — totals, flags, local dates, hour of day. Columns usually prefixed drv_ are calculations; the rest are carried over from input.',
  },
  {
    id: 'semantic', label: 'Semantic Layer', short: 'SEM', color: '#10b981', soft: 'rgba(16,185,129,0.07)',
    tagline: 'Business-ready, curated model',
    explain: 'A small set of tables an analyst actually uses, with only the columns that matter and descriptions written in business language. Each table has a clear grain (one row per order, per payment…). Lookup columns turn ids into readable names.',
  },
  {
    id: 'output', label: 'Output Layer', short: 'OUT', color: '#f59e0b', soft: 'rgba(245,158,11,0.07)',
    tagline: 'Reports, KPIs and extracts',
    explain: 'Aggregated tables that feed dashboards and reports — for example daily sales by store. Columns here are sums, counts and ratios of semantic columns, grouped by a few dimensions like date and location.',
  },
];

export const LAYER_ORDER: LayerId[] = LAYERS.map((l) => l.id);
export const layerMeta = (id: LayerId) => LAYERS.find((l) => l.id === id)!;
export const layerIndex = (id: LayerId) => LAYER_ORDER.indexOf(id);

export type KeyType = '' | 'PK' | 'FK';
export type Origin = '' | 'Input' | 'Derived';

export interface Column {
  id: string;
  name: string;
  definition: string;
  dataType: string;
  key: KeyType;
  origin: Origin;          // semantic "Input / Derived"
  lookup: boolean;         // semantic is_lookup_column
  sourceTable: string;     // input "SOR Table"
  sourceField: string;     // input "SOR Field"
  raw: Record<string, string>; // the untouched CSV row, shown on hover
  predicted?: boolean;
  reason?: string;         // why a predicted column was proposed
  confidence?: number;
}

export type TableRole = 'fact' | 'dimension' | 'reference' | 'bridge' | 'aggregate' | 'source';

export interface Table {
  id: string;
  name: string;
  layer: LayerId;
  description: string;
  columns: Column[];
  predicted?: boolean;
  reason?: string;
  confidence?: number;
}

export type EdgeKind = 'map' | 'calc' | 'lookup' | 'agg' | 'manual';

/** A user-made or prediction-made link that is stored, not recomputed. */
export interface StoredLink {
  id: string;
  from: string; // column id (upstream)
  to: string;   // column id (downstream)
  kind: EdgeKind;
  reason: string;
  predicted?: boolean;
}

/** Canonical fields a layer file can map its headers onto. */
export type FieldKey =
  | 'table' | 'column' | 'definition' | 'dataType' | 'key'
  | 'sourceTable' | 'sourceField' | 'origin' | 'lookup';

export type HeaderMapping = Partial<Record<FieldKey, string>>;

export interface LayerFile {
  fileName: string;
  sheetName: string;
  headers: string[];
  mapping: HeaderMapping;
  rowCount: number;
  loadedAt: string;
}

export interface Workspace {
  version: 1;
  name: string;
  tables: Table[];
  links: StoredLink[];
  suppressed: string[];          // auto edges the user deleted: `${from}>${to}`
  files: Partial<Record<LayerId, LayerFile>>;
  showSource: boolean;
}

export const emptyWorkspace = (): Workspace => ({
  version: 1,
  name: 'Untitled pipeline',
  tables: [],
  links: [],
  suppressed: [],
  files: {},
  showSource: true,
});

let counter = 0;
export const uid = (p = 'x') =>
  `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
