import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef, ModuleRegistry, CellValueChangedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Download, Search, Waypoints } from 'lucide-react';
import { useDE } from '../store';
import { KeyType, LayerId, layerMeta, Origin } from '../types';
import { EDGE_INFO } from '../explain';
import { download } from '../exporters';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Row {
  id: string;
  layer: LayerId;
  table: string;
  column: string;
  key: KeyType;
  dataType: string;
  origin: Origin;
  lookup: boolean;
  definition: string;
  upstream: string;
  linkType: string;
  confidence: number | null;
  usedBy: number;
  predicted: boolean;
}

export default function CatalogView() {
  const { graph, updateColumn, focusColumn } = useDE();
  const [q, setQ] = useState('');
  const [layers, setLayers] = useState<Set<LayerId>>(new Set());
  const [onlyUntraced, setOnlyUntraced] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const t of graph.tables) {
      if (layers.size && !layers.has(t.layer)) continue;
      for (const c of t.columns) {
        const ups = graph.up.get(c.id) ?? [];
        if (onlyUntraced && (ups.length || t.layer === 'source')) continue;
        const best = ups.reduce<typeof ups[number] | null>((a, e) => (!a || e.confidence > a.confidence ? e : a), null);
        const from = best ? graph.colById.get(best.from) : undefined;
        out.push({
          id: c.id, layer: t.layer, table: t.name, column: c.name, key: c.key, dataType: c.dataType, origin: c.origin,
          lookup: c.lookup, definition: c.definition,
          upstream: from ? `${from.table.name}.${from.col.name}${ups.length > 1 ? ` (+${ups.length - 1})` : ''}` : '',
          linkType: best ? EDGE_INFO[best.kind].label : '', confidence: best ? Math.round(best.confidence * 100) : null,
          usedBy: (graph.down.get(c.id) ?? []).length, predicted: !!c.predicted,
        });
      }
    }
    return out;
  }, [graph, layers, onlyUntraced]);

  const cols = useMemo<ColDef<Row>[]>(() => [
    {
      field: 'layer', headerName: 'Layer', width: 105, filter: true,
      cellRenderer: (p: { value: LayerId }) => {
        const m = layerMeta(p.value);
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${m.color}22`, color: m.color }}>{m.short}</span>;
      },
    },
    { field: 'table', headerName: 'Table', width: 190, filter: true, cellClass: 'font-mono' },
    { field: 'column', headerName: 'Column', width: 230, filter: true, editable: true, cellClass: 'font-mono font-semibold' },
    { field: 'key', headerName: 'Key', width: 80, editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['', 'PK', 'FK'] } },
    { field: 'dataType', headerName: 'Data type', width: 150, editable: true, filter: true },
    { field: 'origin', headerName: 'Input / Derived', width: 125, editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['', 'Input', 'Derived'] } },
    { field: 'definition', headerName: 'Definition', flex: 1, minWidth: 320, editable: true, cellEditor: 'agLargeTextCellEditor', cellEditorPopup: true, cellEditorParams: { maxLength: 4000, rows: 8, cols: 60 }, tooltipField: 'definition' },
    { field: 'upstream', headerName: 'Comes from', width: 260, filter: true, cellClass: 'font-mono' },
    { field: 'linkType', headerName: 'Link', width: 110, filter: true },
    { field: 'confidence', headerName: 'Conf. %', width: 90, filter: 'agNumberColumnFilter' },
    { field: 'usedBy', headerName: 'Used by', width: 90, filter: 'agNumberColumnFilter' },
    {
      headerName: '', width: 60, sortable: false, filter: false,
      cellRenderer: (p: { data: Row }) => (
        <button title="Show on canvas" onClick={() => focusColumn(p.data.id)} className="text-primary hover:opacity-70 cursor-pointer mt-2"><Waypoints size={15} /></button>
      ),
    },
  ], [focusColumn]);

  const onEdit = (e: CellValueChangedEvent<Row>) => {
    const v = e.newValue ?? '';
    const f = e.colDef.field;
    if (f === 'column' && String(v).trim()) updateColumn(e.data.id, { name: String(v).trim() });
    else if (f === 'definition') updateColumn(e.data.id, { definition: String(v) });
    else if (f === 'dataType') updateColumn(e.data.id, { dataType: String(v) });
    else if (f === 'key') updateColumn(e.data.id, { key: v as KeyType });
    else if (f === 'origin') updateColumn(e.data.id, { origin: v as Origin });
  };

  const exportView = () => {
    const esc = (s: unknown) => { const x = String(s ?? ''); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
    const head = ['Layer', 'Table', 'Column', 'Key', 'Data Type', 'Input / Derived', 'Definition', 'Comes From', 'Link', 'Confidence', 'Used By'];
    const body = rows.map((r) => [layerMeta(r.layer).label, r.table, r.column, r.key, r.dataType, r.origin, r.definition, r.upstream, r.linkType, r.confidence ?? '', r.usedBy].map(esc).join(','));
    download('Data catalog.csv', [head.join(','), ...body].join('\r\n'));
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps">Data catalog</div>
          <h2 className="text-xl font-bold text-on-surface">Every column, in one searchable list</h2>
          <p className="text-[12.5px] text-on-surface-variant">Double-click a cell to edit names, keys, types or definitions. Changes appear on the canvas immediately.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-surface-container-lowest w-64">
            <Search size={14} className="text-on-surface-variant" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search anything…" className="flex-1 bg-transparent outline-none text-[12px] text-on-surface" />
          </div>
          {graph.layersPresent.map((l) => {
            const m = layerMeta(l); const on = layers.has(l);
            return (
              <button key={l} onClick={() => setLayers((s) => { const n = new Set(s); if (n.has(l)) n.delete(l); else n.add(l); return n; })}
                className="px-2 py-1.5 rounded-lg border text-[10.5px] font-bold cursor-pointer bg-surface-container-lowest"
                style={{ borderColor: on ? m.color : 'var(--color-border)', color: on ? m.color : 'var(--color-on-surface-variant)' }}>
                {m.short}
              </button>
            );
          })}
          <button onClick={() => setOnlyUntraced((v) => !v)} className={`btn-de ${onlyUntraced ? 'btn-de-active' : ''}`}>Untraced only</button>
          <button onClick={exportView} className="btn-de"><Download size={13} /> CSV</button>
        </div>
      </div>
      <div className="text-[11.5px] text-on-surface-variant">{rows.length.toLocaleString()} columns</div>
      <div className="flex-1 min-h-0 ag-theme-alpine rounded-xl overflow-hidden border border-border">
        <AgGridReact<Row>
          rowData={rows}
          columnDefs={cols}
          getRowId={(p) => p.data.id}
          quickFilterText={q}
          theme="legacy"
          defaultColDef={{ sortable: true, resizable: true }}
          onCellValueChanged={onEdit}
          stopEditingWhenCellsLoseFocus
          tooltipShowDelay={400}
          rowClassRules={{ 'opacity-70': (p) => !!p.data?.predicted }}
        />
      </div>
    </div>
  );
}
