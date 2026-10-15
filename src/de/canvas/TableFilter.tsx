import { useMemo, useState } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { Graph } from '../graph';
import { LayerId, LAYER_ORDER, layerMeta } from '../types';

/** Toolbar popover: choose exactly which tables of each layer are on the canvas. */
export default function TableFilter({ g, layers, hidden, setHidden }: {
  g: Graph;
  layers: LayerId[];
  hidden: Set<string>;
  setHidden: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const groups = useMemo(() => LAYER_ORDER.filter((l) => layers.includes(l)).map((l) => ({
    layer: l,
    tables: g.tables.filter((t) => t.layer === l).sort((a, b) => a.name.localeCompare(b.name)),
  })), [g, layers]);
  const total = groups.reduce((n, x) => n + x.tables.length, 0);
  const shown = groups.reduce((n, x) => n + x.tables.filter((t) => !hidden.has(t.id)).length, 0);
  const term = q.trim().toLowerCase();

  const setMany = (ids: string[], hide: boolean) => {
    const n = new Set(hidden);
    ids.forEach((id) => (hide ? n.add(id) : n.delete(id)));
    setHidden(n);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className={`btn-de ${open || hidden.size ? 'btn-de-active' : ''}`} title="Choose which tables are shown">
        <Filter size={13} /> Tables {hidden.size > 0 && <span className="font-mono">{shown}/{total}</span>}
      </button>
      {open && (
        <div className="nowheel absolute left-0 mt-1 w-80 glass-card-elevated !rounded-xl p-2 z-40">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border mb-2">
            <Search size={13} className="text-on-surface-variant" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tables…"
              className="flex-1 bg-transparent outline-none text-[12px] text-on-surface" />
            {q && <button onClick={() => setQ('')} className="text-on-surface-variant cursor-pointer"><X size={12} /></button>}
          </div>
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            {groups.map(({ layer, tables }) => {
              const m = layerMeta(layer);
              const list = term ? tables.filter((t) => t.name.toLowerCase().includes(term)) : tables;
              if (!list.length) return null;
              const on = list.filter((t) => !hidden.has(t.id)).length;
              return (
                <div key={layer} className="mb-2">
                  <div className="flex items-center justify-between px-2 py-1 sticky top-0 bg-[rgba(10,16,28,0.95)] rounded-md z-10">
                    <span className="text-[10.5px] font-bold" style={{ color: m.color }}>{m.label.toUpperCase()} · {on}/{list.length}</span>
                    <span className="flex gap-1">
                      <button onClick={() => setMany(list.map((t) => t.id), false)} className="btn-de-sm !py-0.5">All</button>
                      <button onClick={() => setMany(list.map((t) => t.id), true)} className="btn-de-sm !py-0.5">None</button>
                    </span>
                  </div>
                  {list.map((t) => (
                    <label key={t.id} className="menu-item-de !py-1 cursor-pointer">
                      <input type="checkbox" checked={!hidden.has(t.id)} onChange={(e) => setMany([t.id], !e.target.checked)} style={{ accentColor: m.color }} />
                      <span className="font-mono text-[11.5px] truncate flex-1">{t.name}</span>
                      <span className="text-[10px] text-on-surface-variant">{t.columns.length}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
          {hidden.size > 0 && (
            <button onClick={() => setHidden(new Set())} className="menu-item-de justify-center !text-primary mt-1">Show every table</button>
          )}
        </div>
      )}
    </div>
  );
}
