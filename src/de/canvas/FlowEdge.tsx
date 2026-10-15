import { memo } from 'react';
import { BaseEdge, Edge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath, useStore } from '@xyflow/react';

export type FlowEdgeData = {
  color: string;
  width: number;      // on-screen pixels, independent of zoom
  opacity: number;
  dash?: string;      // on-screen pixels, independent of zoom
  label?: string;
  loop?: boolean;     // same-side handles (right → right)
};

export type FlowEdgeType = Edge<FlowEdgeData, 'flow'>;

const zoomSel = (s: { transform: [number, number, number] }) => s.transform[2];

/**
 * Orthogonal edge with rounded corners (like Supabase's schema view). Stroke
 * width and dashes are divided by the zoom so lines stay crisp and thin at any
 * zoom level instead of turning into thick bands.
 */
function FlowEdgeImpl(p: EdgeProps<FlowEdgeType>) {
  const zoom = useStore(zoomSel);
  const d = p.data!;
  const z = Math.max(zoom, 0.05);
  const [path, lx, ly] = getSmoothStepPath({
    sourceX: p.sourceX, sourceY: p.sourceY, sourcePosition: p.sourcePosition,
    targetX: p.targetX, targetY: p.targetY, targetPosition: p.targetPosition,
    borderRadius: 10, offset: d.loop ? 24 : 16,
  });
  const dash = d.dash ? d.dash.split(/\s+/).map((n) => Number(n) / z).join(' ') : undefined;
  return (
    <>
      <BaseEdge
        id={p.id}
        path={path}
        markerEnd={p.markerEnd}
        interactionWidth={12 / z}
        style={{ stroke: d.color, strokeWidth: d.width / z, strokeDasharray: dash, opacity: d.opacity, transition: 'opacity .15s ease' }}
      />
      {d.label && (
        <EdgeLabelRenderer>
          <div
            className="absolute pointer-events-none px-1.5 py-0.5 rounded-md text-[10px] font-bold border shadow-sm bg-surface-container-lowest"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px) scale(${1 / z})`, color: d.color, borderColor: d.color }}
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const FlowEdge = memo(FlowEdgeImpl);
