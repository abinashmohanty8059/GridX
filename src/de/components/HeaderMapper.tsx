import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { autoMapHeaders, FIELD_LABELS, LAYER_FIELDS, ParsedSheet, rowsToTables } from '../parse';
import { FieldKey, HeaderMapping, LayerId, LAYERS, layerMeta } from '../types';

export interface MapperRequest {
  fileName: string;
  sheets: ParsedSheet[];
  sheetIdx: number;
  layer: LayerId | null;      // null → let the user choose
  mapping: HeaderMapping;
  existing: boolean;          // remapping an already-loaded layer
}

export default function HeaderMapper({ req, onCancel, onApply }: {
  req: MapperRequest;
  onCancel: () => void;
  onApply: (layer: LayerId, sheet: ParsedSheet, mapping: HeaderMapping) => void;
}) {
  const [layer, setLayer] = useState<LayerId | null>(req.layer);
  const [sheetIdx, setSheetIdx] = useState(req.sheetIdx);
  const [mapping, setMapping] = useState<HeaderMapping>(req.mapping);
  const sheet = req.sheets[sheetIdx];
  const fields = layer ? LAYER_FIELDS[layer] : LAYER_FIELDS.input;
  const preview = sheet.rows.filter((r) => Object.values(r).some(Boolean)).slice(0, 6);

  const result = useMemo(() => {
    if (!layer || !mapping.table || !mapping.column) return null;
    const tables = rowsToTables(sheet.rows, mapping, layer);
    return { tables: tables.length, cols: tables.reduce((n, t) => n + t.columns.length, 0) };
  }, [layer, mapping, sheet]);

  const colorFor = (h: string) => {
    const f = (Object.keys(mapping) as FieldKey[]).find((k) => mapping[k] === h);
    return f ? (layer ? layerMeta(layer).color : '#0ea5e9') : undefined;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="glass-card-elevated w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-on-surface">Match your headers</h3>
            <p className="text-xs text-on-surface-variant mt-0.5 truncate">
              {req.fileName}{req.sheets.length > 1 ? ` · sheet "${sheet.name}"` : ''} · {sheet.rows.length} rows · {sheet.headers.length} headers
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant cursor-pointer"><X size={16} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="flex flex-wrap gap-4">
            <label className="text-xs text-on-surface-variant">
              <span className="label-caps block mb-1">Layer</span>
              <select value={layer ?? ''} disabled={req.existing}
                onChange={(e) => { const l = e.target.value as LayerId; setLayer(l); setMapping(autoMapHeaders(sheet.headers, l)); }}
                className="px-3 py-2 rounded-lg border border-border bg-surface-container-lowest text-on-surface text-sm">
                <option value="" disabled>Choose a layer…</option>
                {LAYERS.filter((l) => l.id !== 'source').map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            {req.sheets.length > 1 && (
              <label className="text-xs text-on-surface-variant">
                <span className="label-caps block mb-1">Sheet</span>
                <select value={sheetIdx}
                  onChange={(e) => { const i = Number(e.target.value); setSheetIdx(i); if (layer) setMapping(autoMapHeaders(req.sheets[i].headers, layer)); }}
                  className="px-3 py-2 rounded-lg border border-border bg-surface-container-lowest text-on-surface text-sm">
                  {req.sheets.map((s, i) => <option key={s.name} value={i}>{s.name} ({s.rows.length} rows)</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {fields.map((f) => {
              const info = FIELD_LABELS[f];
              return (
                <label key={f} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-container-lowest">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-on-surface flex items-center gap-1.5">
                      {info.label}{info.required && <span className="text-error">*</span>}
                      {mapping[f] && <Check size={13} className="text-success" />}
                    </div>
                    <div className="text-[11px] text-on-surface-variant truncate">{info.hint}</div>
                  </div>
                  <select value={mapping[f] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value || undefined }))}
                    className="w-44 px-2 py-1.5 rounded-md border border-border bg-surface text-on-surface text-[12px]">
                    <option value="">— not in file —</option>
                    {sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              );
            })}
          </div>

          <div>
            <div className="label-caps mb-2">Preview</div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="text-[11px] w-max min-w-full">
                <thead>
                  <tr className="bg-surface-container-low">
                    {sheet.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                        style={{ color: colorFor(h) ?? 'var(--color-on-surface-variant)', borderBottom: colorFor(h) ? `2px solid ${colorFor(h)}` : undefined }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {sheet.headers.map((h) => (
                        <td key={h} className="px-3 py-1.5 text-on-surface max-w-[260px] truncate" title={r[h]}>{r[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 bg-surface-container-low">
          <span className="text-xs text-on-surface-variant">
            {result ? <>This will create <b className="text-on-surface">{result.tables}</b> tables with <b className="text-on-surface">{result.cols}</b> columns.</> : 'Choose a layer and map at least Table name and Column name.'}
            {req.existing && <span className="block text-[11px] text-warning mt-0.5">Re-mapping rebuilds this layer; manual edits to it are replaced (Undo brings them back).</span>}
          </span>
          <div className="flex gap-2 shrink-0">
            <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container cursor-pointer">Cancel</button>
            <button disabled={!result} onClick={() => layer && onApply(layer, sheet, mapping)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary-container hover:opacity-90 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              Apply mapping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
