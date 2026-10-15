import { Graph } from './graph';
import { LayerId, LAYERS, Table, Workspace } from './types';

const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function download(filename: string, text: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const toCsv = (headers: string[], rows: unknown[][]) =>
  [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');

/** Export a layer using the same header layout as the POS structure files. */
export function layerCsv(ws: Workspace, g: Graph, layer: LayerId): string {
  const tables = ws.tables.filter((t) => t.layer === layer);
  const upstream = (id: string) => {
    const e = (g.up.get(id) ?? [])[0];
    const r = e ? g.colById.get(e.from) : undefined;
    return r ? [r.table.name, r.col.name] : ['', ''];
  };
  const rows: unknown[][] = [];
  if (layer === 'input') {
    for (const t of tables) for (const c of t.columns) rows.push([c.sourceTable, c.sourceField, t.name, c.name, c.definition, c.dataType, c.key]);
    return toCsv(['SOR Table', 'SOR Field', 'Current Table', 'Current Column', 'Definition', 'Data Type', 'Key'], rows);
  }
  if (layer === 'semantic') {
    for (const t of tables) for (const c of t.columns) rows.push([t.name, c.name, c.origin, c.dataType, c.definition, c.key, c.lookup ? 'Lookup' : '']);
    return toCsv(['Table', 'Column Name', 'Input / Derived', 'Type', 'Description', 'Key', 'is_lookup_column'], rows);
  }
  if (layer === 'output') {
    for (const t of tables) for (const c of t.columns) {
      const [st, sc] = upstream(c.id);
      rows.push([t.name, c.name, c.definition, c.dataType, c.key, c.raw.Aggregation ?? '', st, c.raw['Source columns'] ?? sc]);
    }
    return toCsv(['Table', 'Column Name', 'Definition', 'Data Type', 'Key', 'Aggregation', 'Source Table', 'Source Column'], rows);
  }
  for (const t of tables) for (const c of t.columns) rows.push([t.name, c.name, c.definition, c.dataType, c.key]);
  return toCsv(['Table', 'Column Name', 'Definition', 'Data Type', 'Key'], rows);
}

export function lineageCsv(g: Graph): string {
  const rows = g.edges.map((e) => {
    const a = g.colById.get(e.from)!; const b = g.colById.get(e.to)!;
    return [a.table.layer, a.table.name, a.col.name, b.table.layer, b.table.name, b.col.name, e.kind, e.confidence.toFixed(2), e.auto ? 'auto' : 'stored', e.reason];
  });
  return toCsv(['From Layer', 'From Table', 'From Column', 'To Layer', 'To Table', 'To Column', 'Link Type', 'Confidence', 'Origin', 'Reason'], rows);
}

export function relationsCsv(g: Graph): string {
  const rows = g.relations.map((r) => {
    const a = g.colById.get(r.from)!; const b = g.colById.get(r.to)!;
    return [a.table.layer, a.table.name, a.col.name, b.table.name, b.col.name, r.confidence.toFixed(2), r.reason];
  });
  return toCsv(['Layer', 'Table', 'Foreign Key', 'References Table', 'References Column', 'Confidence', 'Reason'], rows);
}

export function exportLayer(ws: Workspace, g: Graph, layer: LayerId) {
  const label = LAYERS.find((l) => l.id === layer)!.label;
  download(`${ws.name} - ${label}.csv`, layerCsv(ws, g, layer));
}

export function exportProject(ws: Workspace) {
  download(`${ws.name}.gridx-pipeline.json`, JSON.stringify(ws), 'application/json');
}

export async function importProject(file: File): Promise<Workspace> {
  const data = JSON.parse(await file.text()) as Workspace;
  if (data?.version !== 1 || !Array.isArray(data.tables)) throw new Error('Not a GridX pipeline project file.');
  return data;
}

export const tableCount = (ws: Workspace, layer: LayerId) => ws.tables.filter((t: Table) => t.layer === layer).length;
