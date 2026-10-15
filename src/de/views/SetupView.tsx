import { useRef, useState, DragEvent, ReactNode } from 'react';
import {
  ArrowRight, CheckCircle2, ChevronDown, Download, FileJson, FileSpreadsheet, FolderOpen, HelpCircle,
  RefreshCw, Settings2, Sparkles, Trash2, UploadCloud, Waypoints, X,
} from 'lucide-react';
import { useDE, LayerFileWithRows } from '../store';
import { autoMapHeaders, guessLayer, ParsedSheet, readLayerFile } from '../parse';
import { HeaderMapping, LayerId, LAYERS, layerMeta } from '../types';
import HeaderMapper, { MapperRequest } from '../components/HeaderMapper';
import { download, exportLayer, exportProject, importProject, lineageCsv, relationsCsv } from '../exporters';

const STEPS: { id: LayerId; required: boolean; hint: string }[] = [
  { id: 'input', required: true, hint: 'Your raw tables — e.g. SOR Table, SOR Field, Current Table, Current Column, Definition, Data Type, Key' },
  { id: 'derived', required: false, hint: 'Joined & calculated tables — Table, Column Name, Definition, Data Type, Key' },
  { id: 'semantic', required: false, hint: 'Business tables — Table, Column Name, Input / Derived, Type, Description, Key, is_lookup_column' },
  { id: 'output', required: false, hint: 'Report tables — Table, Column Name, Definition, plus Source Table / Source Column if you have them' },
];

function DropZone({ onFiles, children, className = '' }: { onFiles: (f: File[]) => void; children: ReactNode; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setOver(false);
    const files = [...e.dataTransfer.files].filter((f) => /\.(csv|tsv|txt|xlsx|xlsm|xls)$/i.test(f.name));
    if (files.length) onFiles(files);
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => input.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors ${over ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'} ${className}`}
    >
      <input ref={input} type="file" multiple accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls" className="hidden"
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) onFiles(f); }} />
      {children}
    </div>
  );
}

export default function SetupView() {
  const {
    ws, graph, loadLayer, remapLayer, removeLayer, predict, acceptPredictions, discardPredictions,
    renameWorkspace, replaceWorkspace, resetWorkspace, setView, setShowSource,
  } = useDE();
  const [mapper, setMapper] = useState<MapperRequest | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [openHelp, setOpenHelp] = useState<LayerId | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const projectInput = useRef<HTMLInputElement>(null);

  const say = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 4500);
  };

  const commitLayer = (layer: LayerId, fileName: string, sheet: ParsedSheet, mapping: HeaderMapping) => {
    const file: LayerFileWithRows = {
      fileName, sheetName: sheet.name, headers: sheet.headers, mapping,
      rowCount: sheet.rows.length, loadedAt: new Date().toISOString(), rows: sheet.rows,
    };
    loadLayer(layer, file);
  };

  /** Load files; `forLayer` pins them to one card, otherwise layers are guessed. */
  const handleFiles = async (files: File[], forLayer?: LayerId) => {
    setBusy(true);
    const loaded: string[] = [];
    try {
      for (const f of files) {
        const parsed = await readLayerFile(f);
        const sheets = parsed.sheets.filter((s) => s.headers.length >= 2 && s.rows.length);
        if (!sheets.length) { say(`${f.name} has no table-like sheet.`, 'warn'); continue; }
        // A workbook may hold several layers as separate sheets.
        const targets = forLayer
          ? [{ sheet: sheets.find((s) => guessLayer(s.name) === forLayer) ?? sheets[0], layer: forLayer as LayerId | null }]
          : sheets.length > 1 && sheets.some((s) => guessLayer(s.name))
            ? sheets.map((s) => ({ sheet: s, layer: guessLayer(s.name) })).filter((x) => x.layer)
            : [{ sheet: sheets[0], layer: guessLayer(f.name) }];
        for (const { sheet, layer } of targets) {
          const mapping = layer ? autoMapHeaders(sheet.headers, layer) : {};
          if (layer && mapping.table && mapping.column) {
            commitLayer(layer, f.name, sheet, mapping);
            loaded.push(layerMeta(layer).label);
          } else {
            setMapper({ fileName: f.name, sheets, sheetIdx: sheets.indexOf(sheet), layer, mapping, existing: false });
          }
        }
      }
      if (loaded.length) say(`Loaded ${loaded.join(', ')} — headers matched automatically. Use "Map headers" to adjust.`);
    } catch (e) {
      say(`Could not read file: ${(e as Error).message}`, 'warn');
    } finally {
      setBusy(false);
    }
  };

  const openRemap = (layer: LayerId) => {
    const f = ws.files[layer] as LayerFileWithRows | undefined;
    if (!f) return;
    setMapper({
      fileName: f.fileName, sheets: [{ name: f.sheetName, headers: f.headers, rows: f.rows }],
      sheetIdx: 0, layer, mapping: f.mapping, existing: true,
    });
  };

  const runPredict = (layer: 'semantic' | 'output') => {
    const n = predict(layer);
    if (n) say(`Predicted ${n} ${layer} table${n > 1 ? 's' : ''}. They are marked ✦ on the canvas — review, edit and accept them.`);
    else say(`Nothing to predict — load the ${layer === 'semantic' ? 'derived or input' : 'semantic or derived'} layer first.`, 'warn');
  };

  const hasInput = ws.tables.some((t) => t.layer === 'input');
  const hasSource = ws.tables.some((t) => t.layer === 'source') || ws.files.input?.mapping.sourceTable;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="label-caps mb-1">Pipeline setup</div>
            <input value={ws.name} onChange={(e) => renameWorkspace(e.target.value)}
              className="text-2xl font-bold text-on-surface bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none w-full max-w-[32rem]"
              aria-label="Pipeline name" />
            <p className="text-sm text-on-surface-variant mt-1">
              Upload each layer of your data pipeline. GridX links every column to where it comes from and draws the whole thing as one map.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={projectInput} type="file" accept=".json" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              try { replaceWorkspace(await importProject(f)); say(`Opened ${f.name}`); } catch (err) { say((err as Error).message, 'warn'); }
            }} />
            <button onClick={() => projectInput.current?.click()} className="btn-de"><FolderOpen size={14} /> Open project</button>
            <button onClick={() => exportProject(ws)} disabled={!ws.tables.length} className="btn-de"><FileJson size={14} /> Save project</button>
            <div className="relative">
              <button onClick={() => setExportOpen((v) => !v)} disabled={!ws.tables.length} className="btn-de"><Download size={14} /> Export <ChevronDown size={12} /></button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-64 glass-card-elevated p-1.5 z-30" onMouseLeave={() => setExportOpen(false)}>
                  {LAYERS.filter((l) => l.id !== 'source' && ws.tables.some((t) => t.layer === l.id)).map((l) => (
                    <button key={l.id} onClick={() => { exportLayer(ws, graph, l.id); setExportOpen(false); }} className="menu-item-de">
                      <FileSpreadsheet size={14} style={{ color: l.color }} /> {l.label} (CSV)
                    </button>
                  ))}
                  <div className="h-px bg-border my-1" />
                  <button onClick={() => { download(`${ws.name} - Lineage.csv`, lineageCsv(graph)); setExportOpen(false); }} className="menu-item-de">
                    <Waypoints size={14} className="text-violet-500" /> Column lineage (CSV)
                  </button>
                  <button onClick={() => { download(`${ws.name} - Relationships.csv`, relationsCsv(graph)); setExportOpen(false); }} className="menu-item-de">
                    <Waypoints size={14} className="text-slate-500" /> Key relationships (CSV)
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => { if (window.confirm('Clear the whole pipeline? You can undo this.')) resetWorkspace(); }}
              disabled={!ws.tables.length} className="btn-de hover:!text-error"><Trash2 size={14} /> Clear</button>
          </div>
        </div>

        {/* Bulk drop */}
        <DropZone onFiles={(f) => handleFiles(f)} className="p-6 flex items-center gap-5 bg-surface-container-lowest">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {busy ? <RefreshCw size={22} className="animate-spin" /> : <UploadCloud size={22} />}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-on-surface">Drop all your layer files here</div>
            <div className="text-xs text-on-surface-variant mt-0.5">
              CSV or Excel. Files (or sheets) named like “… Input Layer”, “… Derived Layer”, “… Semantic Layer” go to the right place automatically. Nothing leaves this computer.
            </div>
          </div>
        </DropZone>

        {/* Layer steps */}
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STEPS.map((step, i) => {
            const lm = layerMeta(step.id);
            const tables = ws.tables.filter((t) => t.layer === step.id);
            const real = tables.filter((t) => !t.predicted);
            const predicted = tables.filter((t) => t.predicted);
            const file = ws.files[step.id];
            const cols = tables.reduce((n, t) => n + t.columns.length, 0);
            const traced = tables.reduce((n, t) => n + t.columns.filter((c) => graph.up.has(c.id)).length, 0);
            const canPredict = step.id === 'semantic'
              ? ws.tables.some((t) => t.layer === 'derived' || t.layer === 'input')
              : ws.tables.some((t) => ['semantic', 'derived', 'input'].includes(t.layer));
            return (
              <div key={step.id} className="glass-card !transform-none flex flex-col overflow-hidden">
                <div className="h-1" style={{ background: lm.color }} />
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold tracking-widest" style={{ color: lm.color }}>STEP {i + 1}</div>
                      <div className="font-bold text-on-surface flex items-center gap-1.5">
                        {lm.label}
                        <button onClick={() => setOpenHelp(openHelp === step.id ? null : step.id)} className="text-on-surface-variant hover:text-primary cursor-pointer" title="What is this layer?">
                          <HelpCircle size={14} />
                        </button>
                      </div>
                      <div className="text-[11px] text-on-surface-variant">{lm.tagline}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${step.required ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                      {step.required ? 'REQUIRED' : 'OPTIONAL'}
                    </span>
                  </div>
                  {openHelp === step.id && <p className="text-[12px] leading-relaxed text-on-surface-variant bg-surface-container-low rounded-lg p-3">{lm.explain}</p>}

                  {real.length > 0 ? (
                    <div className="rounded-lg bg-surface-container-low p-3 text-[12px] space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-on-surface truncate" title={file?.fileName}>
                        <CheckCircle2 size={14} className="text-success shrink-0" />
                        <span className="truncate">{file?.fileName ?? 'Edited by hand'}</span>
                      </div>
                      <div className="text-on-surface-variant">{real.length} tables · {cols} columns</div>
                      <div className="text-on-surface-variant">
                        {step.id === 'input' && !ws.showSource ? 'Source lane hidden' : `${cols ? Math.round((traced / cols) * 100) : 0}% traced to an upstream column`}
                      </div>
                    </div>
                  ) : (
                    <DropZone onFiles={(f) => handleFiles(f, step.id)} className="p-4 text-center">
                      <UploadCloud size={18} className="mx-auto text-on-surface-variant" />
                      <div className="text-[12px] font-medium text-on-surface mt-1">Drop file or click to browse</div>
                      <div className="text-[10px] text-on-surface-variant mt-1 leading-snug">{step.hint}</div>
                    </DropZone>
                  )}

                  {predicted.length > 0 && (
                    <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-[12px] space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-on-surface">
                        <Sparkles size={14} className="text-amber-500" />
                        {predicted.length} predicted table{predicted.length > 1 ? 's' : ''}
                      </div>
                      <div className="text-on-surface-variant [overflow-wrap:anywhere]">{predicted.map((t) => t.name).slice(0, 4).join(', ')}{predicted.length > 4 ? '…' : ''}</div>
                      <div className="flex gap-1.5">
                        <button onClick={() => acceptPredictions()} className="btn-de-sm">Accept all</button>
                        <button onClick={() => discardPredictions(step.id)} className="btn-de-sm">Discard</button>
                      </div>
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {file && (
                      <>
                        <button onClick={() => openRemap(step.id)} className="btn-de-sm"><Settings2 size={12} /> Map headers</button>
                        <DropZone onFiles={(f) => handleFiles(f, step.id)} className="!border-0 !rounded-md">
                          <span className="btn-de-sm"><RefreshCw size={12} /> Replace</span>
                        </DropZone>
                        <button onClick={() => removeLayer(step.id)} className="btn-de-sm hover:!text-error"><X size={12} /> Remove</button>
                      </>
                    )}
                    {(step.id === 'semantic' || step.id === 'output') && !real.length && (
                      <button onClick={() => runPredict(step.id as 'semantic' | 'output')} disabled={!canPredict}
                        className="btn-de-sm !text-amber-600" title={canPredict ? '' : 'Load an earlier layer first'}>
                        <Sparkles size={12} /> {predicted.length ? 'Predict again' : `Predict ${step.id} layer`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {hasSource && (
          <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer select-none">
            <input type="checkbox" checked={ws.showSource} onChange={(e) => setShowSource(e.target.checked)} className="accent-[#64748b]" />
            Show the source system (SOR Table / SOR Field) as its own lane before the input layer
          </label>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 glass-card !transform-none p-5">
          <div className="text-sm text-on-surface-variant max-w-2xl">
            <b className="text-on-surface">Next:</b> open the canvas. Each lane is a layer; lines show which tables feed which.
            Hover any column to read its definition, click it to trace it end to end, and use the panel on the right to edit the schema.
          </div>
          <button onClick={() => setView('canvas')} disabled={!hasInput && !ws.tables.length}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-container hover:opacity-90 disabled:opacity-40 cursor-pointer flex items-center gap-2">
            Open schema canvas <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {mapper && (
        <HeaderMapper req={mapper} onCancel={() => setMapper(null)} onApply={(layer, sheet, mapping) => {
          if (mapper.existing) remapLayer(layer, mapping);
          else commitLayer(layer, mapper.fileName, sheet, mapping);
          setMapper(null);
          say(`${layerMeta(layer).label} loaded.`);
        }} />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-[28rem] px-4 py-3 rounded-xl shadow-lg text-sm text-white ${toast.tone === 'ok' ? 'bg-[#0D1B2A]' : 'bg-amber-600'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
