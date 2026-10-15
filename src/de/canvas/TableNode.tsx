import { memo, useEffect } from 'react';
import { Handle, NodeProps, Position, Node, useUpdateNodeInternals } from '@xyflow/react';
import { ChevronDown, ChevronUp, KeyRound, Link2, Search, Sparkles } from 'lucide-react';
import { NodeView, FILTER_H, NODE_W } from '../layout';
import { Column, TableRole } from '../types';
import { ROLE_INFO, grainOf } from '../explain';
import { useCanvas } from './canvasContext';

export interface ColumnFlags { calc: boolean; lookup: boolean; traced: boolean; down: number }

export type TableNodeData = {
  view: NodeView;
  role: TableRole;
  color: string;
  selected: boolean;
  dimmed: boolean;
  activeCol: string | null;
  trace: Record<string, number> | null;
  flags: Record<string, ColumnFlags>;
  filter: string;
  showUntraced: boolean;
  vertical: boolean;   // layers flow top → bottom
};

export type TableFlowNode = Node<TableNodeData, 'table'>;

const shortType = (t: string) => t.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().split(' ')[0].toLowerCase().slice(0, 9);

function Row({ c, d }: { c: Column; d: TableNodeData }) {
  const { hover, selectColumn } = useCanvas();
  const f = d.flags[c.id];
  const depth = d.trace ? d.trace[c.id] : undefined;
  const active = d.activeCol === c.id;
  return (
    <div
      className={`de-row ${active ? 'de-row-active' : depth !== undefined ? 'de-row-trace' : ''}`}
      onMouseEnter={(e) => hover({ kind: 'column', id: c.id, x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => hover({ kind: 'column', id: c.id, x: e.clientX, y: e.clientY })}
      onMouseLeave={() => hover(null)}
      onClick={(e) => { e.stopPropagation(); selectColumn(c.id); }}
    >
      <Handle type="target" position={Position.Left} id={`${c.id}-in`} className="de-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} id={`${c.id}-out`} className="de-handle" isConnectable={false} />
      <Handle type="target" position={Position.Right} id={`${c.id}-rin`} className="de-handle" isConnectable={false} />
      <span className="w-3.5 shrink-0 flex justify-center">
        {c.key === 'PK' ? <KeyRound size={11} className="text-amber-500" />
          : c.key === 'FK' ? <Link2 size={11} className="text-sky-500" /> : null}
      </span>
      <span className={`font-mono truncate flex-1 ${c.key ? 'font-semibold text-on-surface' : 'text-on-surface'}`}>{c.name}</span>
      {c.predicted && <Sparkles size={10} className="text-amber-500 shrink-0" />}
      {f?.calc && <span className="text-[10px] font-bold text-violet-500 shrink-0" title="Calculated">ƒ</span>}
      {(c.lookup || f?.lookup) && <span className="text-[9px] font-bold text-emerald-500 shrink-0" title="Lookup">LKP</span>}
      {d.showUntraced && f && !f.traced && <span className="w-1.5 h-1.5 rounded-full border border-on-surface-variant/60 shrink-0" title="No upstream source traced" />}
      {depth !== undefined && depth !== 0 && (
        <span className="text-[9px] font-bold px-1 rounded shrink-0" style={{ background: depth < 0 ? 'rgba(14,165,233,.15)' : 'rgba(245,158,11,.18)', color: depth < 0 ? '#0284c7' : '#b45309' }}>
          {depth < 0 ? `↑${-depth}` : `↓${depth}`}
        </span>
      )}
      <span className="text-[10px] text-on-surface-variant shrink-0 w-12 text-right truncate">{shortType(c.dataType)}</span>
    </div>
  );
}

function TableNodeImpl({ id, data: d }: NodeProps<TableFlowNode>) {
  const { selectTable, toggleExpand, showMore, setFilter, hover } = useCanvas();
  const { view } = d;
  const t = view.table;
  // Rows can swap without the node changing size; re-measure so edges find their handles.
  const updateInternals = useUpdateNodeInternals();
  const rowKey = `${view.visible.map((c) => c.id).join()}|${d.vertical}`;
  useEffect(() => { updateInternals(id); }, [rowKey, id, updateInternals]);
  const role = ROLE_INFO[d.role];
  const remaining = view.expanded
    ? t.columns.filter((c) => !d.filter || c.name.toLowerCase().includes(d.filter.toLowerCase()) || c.definition.toLowerCase().includes(d.filter.toLowerCase())).length - view.visible.length
    : view.hidden;

  return (
    <div
      className={`de-node ${d.selected ? 'de-node-selected' : ''} ${t.predicted ? 'de-node-predicted' : ''}`}
      style={{ width: NODE_W, opacity: d.dimmed ? 0.22 : 1, ['--node-accent' as string]: d.color }}
    >
      {d.vertical ? (
        <>
          <Handle type="target" position={Position.Top} id="t-in" className="de-handle" isConnectable={false} />
          <Handle type="source" position={Position.Bottom} id="t-out" className="de-handle" isConnectable={false} />
        </>
      ) : (
        <>
          <Handle type="target" position={Position.Left} id="t-in" className="de-handle" style={{ top: 22 }} isConnectable={false} />
          <Handle type="source" position={Position.Right} id="t-out" className="de-handle" style={{ top: 22 }} isConnectable={false} />
        </>
      )}
      <Handle type="source" position={Position.Right} id="t-rel-out" className="de-handle" style={{ top: 40 }} isConnectable={false} />
      <Handle type="target" position={Position.Right} id="t-rel-in" className="de-handle" style={{ top: 40 }} isConnectable={false} />

      <div
        className="px-3 pt-2.5 pb-2 border-b border-border cursor-pointer rounded-t-xl"
        style={{ background: `linear-gradient(90deg, ${d.color}1f, transparent 70%)`, borderLeft: `3px solid ${d.color}`, height: 60 }}
        onClick={(e) => { e.stopPropagation(); selectTable(t.id); }}
        onMouseEnter={(e) => hover({ kind: 'table', id: t.id, x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => hover({ kind: 'table', id: t.id, x: e.clientX, y: e.clientY })}
        onMouseLeave={() => hover(null)}
        onDoubleClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-[13px] text-on-surface truncate flex-1" title={t.name}>{t.name}</span>
          {t.predicted && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-600" title={t.reason}>
              <Sparkles size={9} /> PREDICTED
            </span>
          )}
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: `${role.color}1a`, color: role.color }} title={role.explain}>
            {role.label.toUpperCase()}
          </span>
          <button className="nodrag p-0.5 rounded hover:bg-surface-container text-on-surface-variant cursor-pointer"
            onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }} title={view.expanded ? 'Collapse' : 'Show all columns'}>
            {view.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <div className="text-[10.5px] text-on-surface-variant mt-1 truncate">
          {t.columns.length} columns · {grainOf(t)}
        </div>
      </div>

      {view.expanded && (
        <div className="px-2 flex items-center border-b border-border" style={{ height: FILTER_H }}>
          <Search size={12} className="text-on-surface-variant ml-1" />
          <input
            className="nodrag nowheel flex-1 bg-transparent outline-none text-[11px] px-2 text-on-surface"
            placeholder={`Filter ${t.columns.length} columns…`}
            value={d.filter}
            onChange={(e) => setFilter(t.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="py-1">
        {view.visible.map((c) => <Row key={c.id} c={c} d={d} />)}
      </div>

      {(remaining > 0 || view.expanded) && (
        <div className="h-7 px-3 flex items-center justify-between text-[10.5px] border-t border-border">
          {remaining > 0 ? (
            <button className="nodrag text-primary font-semibold hover:underline cursor-pointer"
              onClick={(e) => { e.stopPropagation(); if (view.expanded) showMore(t.id); else toggleExpand(t.id); }}>
              + {remaining} more column{remaining > 1 ? 's' : ''}
            </button>
          ) : <span className="text-on-surface-variant">All columns shown</span>}
          {view.expanded && (
            <button className="nodrag text-on-surface-variant hover:text-on-surface cursor-pointer"
              onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}>Collapse</button>
          )}
        </div>
      )}
    </div>
  );
}

export const TableNode = memo(TableNodeImpl);
