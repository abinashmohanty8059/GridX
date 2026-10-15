import { createContext, useContext } from 'react';

/** What the pointer is over: a column row, a table header, or a line. */
export interface HoverState { kind: 'column' | 'table' | 'edge'; id: string; x: number; y: number }

export interface CanvasActions {
  hover: (h: HoverState | null) => void;
  selectTable: (id: string) => void;
  selectColumn: (id: string) => void;
  toggleExpand: (id: string) => void;
  showMore: (id: string) => void;
  setFilter: (id: string, text: string) => void;
}

export const CanvasCtx = createContext<CanvasActions | null>(null);

export function useCanvas() {
  const c = useContext(CanvasCtx);
  if (!c) throw new Error('useCanvas must be used inside the schema canvas');
  return c;
}
