import * as XLSX from 'xlsx';
import {
  FieldKey, HeaderMapping, KeyType, LayerId, Origin, Table, uid,
} from './types';

// ─── Reading files ───────────────────────────────────────────────────────────

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
}

export interface ParsedFile {
  fileName: string;
  sheets: ParsedSheet[];
}

export async function readLayerFile(file: File): Promise<ParsedFile> {
  const isCsv = /\.(csv|tsv|txt)$/i.test(file.name);
  const wb = isCsv
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return { fileName: file.name, sheets: wb.SheetNames.map((n) => sheetToRows(n, wb.Sheets[n])) };
}

/** Parse CSV text directly (used by tests and project import). */
export function parseCsvText(fileName: string, text: string): ParsedFile {
  const wb = XLSX.read(text, { type: 'string', raw: true });
  return { fileName, sheets: wb.SheetNames.map((n) => sheetToRows(n, wb.Sheets[n])) };
}

function sheetToRows(name: string, ws: XLSX.WorkSheet): ParsedSheet {
  const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false, blankrows: false });
  // The header row is the first row with at least two non-empty cells.
  const hIdx = matrix.findIndex((r) => r.filter((c) => String(c).trim() !== '').length >= 2);
  if (hIdx < 0) return { name, headers: [], rows: [] };
  const seen: Record<string, number> = {};
  const headers = matrix[hIdx].map((h, i) => {
    let label = String(h).trim() || `Column ${i + 1}`;
    if (seen[label] !== undefined) label = `${label} (${++seen[label]})`;
    else seen[label] = 0;
    return label;
  });
  const rows = matrix.slice(hIdx + 1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = String(r[i] ?? '').trim(); });
    return o;
  });
  return { name, headers, rows };
}

// ─── Header mapping ──────────────────────────────────────────────────────────

export const FIELD_LABELS: Record<FieldKey, { label: string; hint: string; required?: boolean }> = {
  table: { label: 'Table name', hint: 'Which table the column belongs to', required: true },
  column: { label: 'Column name', hint: 'The column / field name', required: true },
  definition: { label: 'Definition', hint: 'What the column means' },
  dataType: { label: 'Data type', hint: 'string, integer, decimal…' },
  key: { label: 'Key (PK / FK)', hint: 'Primary or foreign key marker' },
  sourceTable: { label: 'Source table', hint: 'Upstream object, e.g. SOR Table' },
  sourceField: { label: 'Source field', hint: 'Upstream field, e.g. SOR Field' },
  origin: { label: 'Input / Derived', hint: 'Whether the column is carried over or calculated' },
  lookup: { label: 'Lookup flag', hint: 'Marks lookup (id → name) columns' },
};

/** Which fields each layer cares about (drives the mapper UI). */
export const LAYER_FIELDS: Record<LayerId, FieldKey[]> = {
  source: ['table', 'column', 'definition', 'dataType', 'key'],
  input: ['table', 'column', 'definition', 'dataType', 'key', 'sourceTable', 'sourceField'],
  derived: ['table', 'column', 'definition', 'dataType', 'key', 'sourceTable', 'sourceField'],
  semantic: ['table', 'column', 'definition', 'dataType', 'key', 'origin', 'lookup'],
  output: ['table', 'column', 'definition', 'dataType', 'key', 'sourceTable', 'sourceField'],
};

// Exact aliases first (these are the POS headers), then looser "contains" hints.
const ALIASES: Record<FieldKey, { exact: string[]; contains: string[] }> = {
  table: { exact: ['current table', 'table', 'table name', 'target table', 'entity', 'tbl'], contains: ['table'] },
  column: { exact: ['current column', 'column name', 'column', 'field name', 'target column', 'attribute', 'col'], contains: ['column', 'field'] },
  definition: { exact: ['definition', 'description', 'business definition', 'desc', 'meaning', 'comment', 'comments'], contains: ['defin', 'descr', 'meaning'] },
  dataType: { exact: ['data type', 'type', 'datatype', 'dtype'], contains: ['type'] },
  key: { exact: ['key', 'pk/fk', 'key type', 'constraint'], contains: ['key'] },
  sourceTable: { exact: ['sor table', 'source table', 'src table', 'upstream table', 'from table'], contains: ['sor table', 'source table', 'upstream table'] },
  sourceField: { exact: ['sor field', 'source field', 'source column', 'src column', 'upstream column', 'from column'], contains: ['sor field', 'source field', 'source column', 'upstream column'] },
  origin: { exact: ['input / derived', 'input/derived', 'input or derived', 'origin', 'derivation'], contains: ['input / derived', 'input/derived', 'derived'] },
  lookup: { exact: ['is_lookup_column', 'lookup', 'is lookup', 'lookup column'], contains: ['lookup'] },
};

const norm = (s: string) => s.toLowerCase().replace(/[_\s]+/g, ' ').replace(/\s*\/\s*/g, ' / ').trim();

export function autoMapHeaders(headers: string[], layer: LayerId): HeaderMapping {
  const fields = LAYER_FIELDS[layer];
  const mapping: HeaderMapping = {};
  const used = new Set<string>();
  const normed = headers.map((h) => ({ h, n: norm(h) }));
  // Pass 1: exact alias match, in alias priority order.
  for (const f of fields) {
    for (const a of ALIASES[f].exact) {
      const hit = normed.find((x) => !used.has(x.h) && x.n === norm(a));
      if (hit) { mapping[f] = hit.h; used.add(hit.h); break; }
    }
  }
  // Pass 2: substring hints for whatever is still unmapped.
  for (const f of fields) {
    if (mapping[f]) continue;
    for (const a of ALIASES[f].contains) {
      const hit = normed.find((x) => !used.has(x.h) && x.n.includes(norm(a)));
      if (hit) { mapping[f] = hit.h; used.add(hit.h); break; }
    }
  }
  return mapping;
}

/**
 * Guess which layer a file/sheet represents from its name. Names like
 * "Input_Derived_Semantic Structure - Derived Layer" mention several layers,
 * so the mention closest to the end wins.
 */
export function guessLayer(name: string): LayerId | null {
  const n = name.toLowerCase().replace(/\.[a-z0-9]+$/, '');
  const patterns: [LayerId, RegExp][] = [
    ['input', /input|raw|landing|staging|bronze/g],
    ['derived', /derived|drv|transform|silver/g],
    ['semantic', /semantic|sem\b|gold/g],
    ['output', /output|report|mart|kpi|dashboard/g],
  ];
  let best: LayerId | null = null;
  let bestPos = -1;
  for (const [layer, re] of patterns) {
    for (const m of n.matchAll(re)) {
      if (m.index! > bestPos) { bestPos = m.index!; best = layer; }
    }
  }
  return best;
}

// ─── Rows → tables ───────────────────────────────────────────────────────────

const toKey = (v: string): KeyType => {
  const s = v.trim().toUpperCase();
  if (s.includes('PK') || s === 'PRIMARY' || s === 'PRIMARY KEY') return 'PK';
  if (s.includes('FK') || s === 'FOREIGN' || s === 'FOREIGN KEY') return 'FK';
  return '';
};

const toOrigin = (v: string): Origin => {
  const s = v.trim().toLowerCase();
  if (s.startsWith('deriv') || s === 'calculated' || s === 'calc') return 'Derived';
  if (s.startsWith('input') || s === 'source' || s === 'raw') return 'Input';
  return '';
};

const toBool = (v: string) => /^(y|yes|true|1|lookup|x)$/i.test(v.trim());

export function rowsToTables(rows: Record<string, string>[], mapping: HeaderMapping, layer: LayerId): Table[] {
  const get = (r: Record<string, string>, f: FieldKey) => (mapping[f] ? r[mapping[f]!] ?? '' : '');
  const byName = new Map<string, Table>();
  for (const r of rows) {
    const tName = get(r, 'table');
    const cName = get(r, 'column');
    if (!tName || !cName) continue; // spacer / blank rows
    let t = byName.get(tName);
    if (!t) {
      t = { id: uid('t'), name: tName, layer, description: '', columns: [] };
      byName.set(tName, t);
    }
    const definition = get(r, 'definition');
    t.columns.push({
      id: uid('c'),
      name: cName,
      definition,
      dataType: get(r, 'dataType'),
      key: toKey(get(r, 'key')),
      origin: toOrigin(get(r, 'origin')),
      lookup: toBool(get(r, 'lookup')) || /^look\s*up\s*:/i.test(definition),
      sourceTable: get(r, 'sourceTable'),
      sourceField: get(r, 'sourceField'),
      raw: r,
    });
  }
  return [...byName.values()];
}

/**
 * When the input layer names its upstream object/field (SOR Table / SOR Field),
 * we can show the source system as its own lane. One source table per SOR
 * object, one column per SOR field.
 */
export function synthesizeSource(inputTables: Table[]): Table[] {
  const byName = new Map<string, Table>();
  for (const t of inputTables) {
    for (const c of t.columns) {
      if (!c.sourceTable || !c.sourceField) continue;
      let s = byName.get(c.sourceTable);
      if (!s) {
        s = {
          id: uid('t'), name: c.sourceTable, layer: 'source', columns: [],
          description: `Object "${c.sourceTable}" as returned by the source system.`,
        };
        byName.set(c.sourceTable, s);
      }
      if (s.columns.some((x) => x.name === c.sourceField)) continue;
      s.columns.push({
        id: uid('c'), name: c.sourceField, definition: c.definition, dataType: c.dataType,
        key: c.key, origin: '', lookup: false, sourceTable: '', sourceField: '',
        raw: { 'SOR Table': c.sourceTable, 'SOR Field': c.sourceField, 'Landed as': `${t.name}.${c.name}` },
      });
    }
  }
  return [...byName.values()];
}
