import { useState } from 'react';
import { ArrowDownRight, ArrowUpLeft, ChevronUp, X } from 'lucide-react';
import { Graph, TableEdge } from '../graph';
import { LayerId, LAYER_ORDER, layerMeta } from '../types';

/** "28 input tables", "1 semantic table and 2 derived tables" */
function byLayer(g: Graph, edges: TableEdge[], side: 'from' | 'to') {
  const groups = new Map<LayerId, TableEdge[]>();
  for (const e of edges) {
    const l = g.tableById.get(e[side])!.layer;
    (groups.get(l) ?? groups.set(l, []).get(l)!).push(e);
  }
  return LAYER_ORDER.filter((l) => groups.has(l)).map((l) => ({ layer: l, edges: groups.get(l)!.sort((a, b) => b.count - a.count) }));
}

const label = (layer: LayerId, n: number) =>
  `${n} ${layerMeta(layer).label.replace(' Layer', '').replace(' System', '').toLowerCase()} table${n > 1 ? 's' : ''}`;

/**
 * Bottom bar while a table is focused: which tables it takes input from
 * (directly), and which tables it feeds. Each count opens a clickable list.
 */
export default function FocusBar({ g, tableId, onPick, onClear }: {
  g: Graph; tableId: string; onPick: (id: string) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState<'up' | 'down' | null>(null);
  const t = g.tableById.get(tableId);
  if (!t) return null;
  const ups = byLayer(g, g.tableEdges.filter((e) => e.to === tableId), 'from');
  const downs = byLayer(g, g.tableEdges.filter((e) => e.from === tableId), 'to');
  const list = open === 'up' ? ups : open === 'down' ? downs : [];

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 max-w-[calc(100%-2rem)]">
      {open && (
        <div className="nowheel glass-card-elevated !rounded-2xl p-3 w-[440px] max-w-full max-h-[50vh] overflow-y-auto">
          <div className="label-caps !text-[10px] mb-2">{open === 'up' ? `${t.name} takes input from` : `${t.name} feeds`}</div>
          {list.map(({ layer, edges }) => (
            <div key={layer} className="mb-2 last:mb-0">
              <div className="text-[10.5px] font-bold mb-1" style={{ color: layerMeta(layer).color }}>{label(layer, edges.length).toUpperCase()}</div>
              <div className="grid grid-cols-2 gap-x-2">
                {edges.map((e) => {
                  const other = g.tableById.get(open === 'up' ? e.from : e.to)!;
                  return (
                    <button key={e.id} onClick={() => onPick(other.id)} className="menu-item-de !py-1">
                      <span className="font-mono text-[11px] truncate flex-1">{other.name}</span>
                      <span className="text-[10px] text-on-surface-variant shrink-0">{e.count} col{e.count > 1 ? 's' : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-2 rounded-full glass-card-elevated !rounded-full text-[12px] text-on-surface whitespace-nowrap">
        <b className="font-mono">{t.name}</b>
        {ups.length > 0 ? (
          <button onClick={() => setOpen(open === 'up' ? null : 'up')} className="flex items-center gap-1 hover:text-primary cursor-pointer">
            <ArrowUpLeft size={12} /> takes input from {ups.map((x) => label(x.layer, x.edges.length)).join(' and ')}
            <ChevronUp size={12} className={`transition-transform ${open === 'up' ? '' : 'rotate-180'}`} />
          </button>
        ) : <span className="text-on-surface-variant">no traced inputs</span>}
        {downs.length > 0 && (
          <>
            <span className="text-on-surface-variant">·</span>
            <button onClick={() => setOpen(open === 'down' ? null : 'down')} className="flex items-center gap-1 hover:text-primary cursor-pointer">
              <ArrowDownRight size={12} /> feeds {downs.map((x) => label(x.layer, x.edges.length)).join(' and ')}
              <ChevronUp size={12} className={`transition-transform ${open === 'down' ? '' : 'rotate-180'}`} />
            </button>
          </>
        )}
        <button onClick={onClear} className="text-on-surface-variant hover:text-on-surface cursor-pointer flex items-center gap-1"><X size={12} /> Clear</button>
      </div>
    </div>
  );
}
