import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { LayerMeta } from '../types';

export type LaneNodeData = {
  meta: LayerMeta;
  width: number;
  height: number;
  tables: number;
  columns: number;
  traced: number;
  predicted: number;
};

export type LaneFlowNode = Node<LaneNodeData, 'lane'>;

function LaneNodeImpl({ data: d }: NodeProps<LaneFlowNode>) {
  const pct = d.columns ? Math.round((d.traced / d.columns) * 100) : 0;
  return (
    <div
      className="rounded-3xl pointer-events-none"
      style={{ width: d.width, height: d.height, background: d.meta.soft, border: `1px dashed ${d.meta.color}40` }}
    >
      <div className="px-6 pt-5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded" style={{ background: `${d.meta.color}22`, color: d.meta.color }}>{d.meta.short}</span>
          <span className="text-base font-bold text-on-surface">{d.meta.label}</span>
        </div>
        <div className="text-[11px] text-on-surface-variant mt-1">{d.meta.tagline}</div>
        <div className="text-[10.5px] font-mono text-on-surface-variant mt-1.5">
          {d.tables} tables · {d.columns} cols{d.meta.id !== 'source' ? ` · ${pct}% traced` : ''}{d.predicted ? ` · ${d.predicted} predicted` : ''}
        </div>
      </div>
    </div>
  );
}

export const LaneNode = memo(LaneNodeImpl);
