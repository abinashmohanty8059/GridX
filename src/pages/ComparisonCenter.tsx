import { useState } from 'react';
import { useGrid, ComparisonResult } from '../context/GridContext';
import { useTheme } from '../context/ThemeContext';
import { 
  FileSpreadsheet, 
  Upload, 
  RefreshCw, 
  Download, 
  ArrowRightLeft, 
  PlusCircle, 
  MinusCircle, 
  AlertTriangle, 
  Info,
  ShieldCheck
} from 'lucide-react';
import KPICard from '../components/KPICard';

export default function ComparisonCenter() {
  const { compareExcelFiles, triggerSelectFilePath, isLoading } = useGrid();
  const { isDarkMode } = useTheme();

  const [prevPath, setPrevPath] = useState('');
  const [currPath, setCurrPath] = useState('');
  const [result, setResult] = useState<ComparisonResult | null>(null);

  const prevName = prevPath.split('\\').pop()?.split('/').pop() || '';
  const currName = currPath.split('\\').pop()?.split('/').pop() || '';

  const handleSelectPrev = async () => {
    const path = await triggerSelectFilePath();
    if (path) setPrevPath(path);
  };

  const handleSelectCurr = async () => {
    const path = await triggerSelectFilePath();
    if (path) setCurrPath(path);
  };

  const handleRunComparison = async () => {
    if (!prevPath || !currPath) return;
    try {
      const res = await compareExcelFiles(prevPath, currPath);
      setResult(res);
    } catch (err) {
      console.error("Comparison failed:", err);
    }
  };

  // CSV Export for Comparison Report
  const handleExportCSV = () => {
    if (!result || result.changes.length === 0) return;
    const headers = ['Feeder Name', 'Signal Description', 'Change Type', 'Previous Value', 'Current Value', 'Severity'];
    const rows = result.changes.map((c) => [
      c.feederName,
      c.signalName,
      c.changeType.toUpperCase(),
      c.oldValue,
      c.newValue,
      c.severity.toUpperCase(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `scada_comparison_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Badge styler helper for changed properties
  const getChangeBadgeStyle = (changeType: string) => {
    if (isDarkMode) {
      switch (changeType) {
        case 'new':
          return { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.25)' };
        case 'removed':
          return { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.25)' };
        case 'status_change':
          return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.25)' };
        default:
          return { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.25)' };
      }
    } else {
      switch (changeType) {
        case 'new':
          return { backgroundColor: '#E6F4EA', color: '#10B981', borderColor: '#A7F3D0' };
        case 'removed':
          return { backgroundColor: '#FCE8E6', color: '#BA1A1A', borderColor: '#FCA5A5' };
        case 'status_change':
          return { backgroundColor: '#FEF3C7', color: '#D97706', borderColor: '#FCD34D' };
        default:
          return { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' };
      }
    }
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'new': return 'ADDED';
      case 'removed': return 'REMOVED';
      case 'status_change': return 'STATE CHANGED';
      case 'iec_change': return 'IEC104 ADDR';
      case 'node_change': return 'LN NODE PATH';
      case 'protocol_change': return 'PROTOCOL';
      default: return type.toUpperCase();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">Telemetry Comparison Center</h2>
          <p className="text-xs text-on-surface-variant mt-0.5 font-medium">Audit delta differences and config changes between mapping versions.</p>
        </div>
        {result && (
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:bg-primary-container transition-colors cursor-pointer"
          >
            <Download size={14} />
            Export Comparison CSV
          </button>
        )}
      </div>

      {/* Select Files Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Previous File Selector */}
        <div className="glass-card p-5 bg-surface-container-lowest border border-border rounded-xl flex flex-col justify-between space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-on-surface-variant rounded-lg">
              <FileSpreadsheet size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Previous Excel Sheet</h3>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">Select the baseline mapping file for comparison.</p>
              {prevPath ? (
                <div className="text-xs bg-surface-container text-on-surface px-2.5 py-1.5 rounded border border-border-light font-mono truncate max-w-[280px]" title={prevPath}>
                  {prevName}
                </div>
              ) : (
                <span className="text-[11px] text-critical font-bold uppercase tracking-wider block">No baseline file loaded</span>
              )}
            </div>
          </div>
          <button 
            onClick={handleSelectPrev}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Upload size={14} />
            Select Previous Excel
          </button>
        </div>

        {/* Current File Selector */}
        <div className="glass-card p-5 bg-surface-container-lowest border border-border rounded-xl flex flex-col justify-between space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
              <FileSpreadsheet size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Current Excel Sheet</h3>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">Select the current layout file to compile change log.</p>
              {currPath ? (
                <div className="text-xs bg-surface-container text-on-surface px-2.5 py-1.5 rounded border border-border-light font-mono truncate max-w-[280px]" title={currPath}>
                  {currName}
                </div>
              ) : (
                <span className="text-[11px] text-critical font-bold uppercase tracking-wider block">No comparison target file loaded</span>
              )}
            </div>
          </div>
          <button 
            onClick={handleSelectCurr}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary hover:bg-primary-container text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Upload size={14} />
            Select Current Excel
          </button>
        </div>
      </div>

      {/* Compare Trigger Bar */}
      <div className="flex justify-center">
        <button
          onClick={handleRunComparison}
          disabled={!prevPath || !currPath || isLoading}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold shadow transition-all border ${
            !prevPath || !currPath || isLoading
              ? 'bg-slate-200 text-slate-400 border-slate-350 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary-container hover:shadow-lg border-transparent cursor-pointer'
          }`}
        >
          {isLoading ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              Comparing Workbooks...
            </>
          ) : (
            <>
              <ArrowRightLeft size={16} />
              Compare Telemetry Files
            </>
          )}
        </button>
      </div>

      {/* Comparison Results Area */}
      {result ? (
        <div className="space-y-6 animate-fade-in">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            <KPICard title="Compared" value={result.summary.totalComparedSignals} icon={ArrowRightLeft} colorClass="primary" subtitle="Matched signals" />
            <KPICard title="Added" value={result.summary.addedSignals} icon={PlusCircle} colorClass="success" subtitle="New signals" />
            <KPICard title="Removed" value={result.summary.removedSignals} icon={MinusCircle} colorClass="critical" subtitle="Deleted signals" />
            <KPICard title="State Changes" value={result.summary.statusChanges} icon={AlertTriangle} colorClass="warning" subtitle="Telemetry changes" />
            <KPICard title="IEC104 Changes" value={result.summary.iecChanges} icon={Info} colorClass="info" subtitle="Address reallocations" />
            <KPICard title="Node Changes" value={result.summary.nodeChanges} icon={Info} colorClass="info" subtitle="Path adjustments" />
            <KPICard title="Protocol" value={result.summary.protocolChanges} icon={Info} colorClass="info" subtitle="Protocol toggles" />
          </div>

          {/* Change Logs Table */}
          <div className="glass-card bg-surface-container-lowest border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-on-surface tracking-tight mb-4">Detailed Change Timeline ({result.changes.length})</h3>
            
            {result.changes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShieldCheck size={48} className="text-success mb-2 animate-bounce" />
                <p className="text-sm font-bold text-on-surface">Sheets Match Perfectly</p>
                <p className="text-xs text-on-surface-variant mt-1">No telemetry variations or configuration differences detected.</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden shadow-sm max-h-[400px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-container text-on-surface-variant font-bold border-b border-border sticky top-0">
                    <tr>
                      <th className="p-3 w-[150px]">Change Type</th>
                      <th className="p-3 w-[180px]">Feeder Name</th>
                      <th className="p-3">Signal Description</th>
                      <th className="p-3 w-[120px] text-center">Old Config</th>
                      <th className="p-3 w-[120px] text-center">New Config</th>
                      <th className="p-3 w-[100px] text-center">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-container-lowest">
                    {result.changes.map((change, idx) => (
                      <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                        <td className="p-3">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border"
                            style={getChangeBadgeStyle(change.changeType)}
                          >
                            {getChangeTypeLabel(change.changeType)}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-on-surface">{change.feederName}</td>
                        <td className="p-3 text-on-surface-variant leading-relaxed">{change.signalName}</td>
                        <td className="p-3 text-center font-mono text-critical bg-critical/5">
                          {change.oldValue ? (
                            <span className="bg-red-100/50 dark:bg-red-950/20 px-2 py-0.5 rounded font-bold border border-red-200/50">
                              {change.oldValue}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono text-success bg-success/5">
                          {change.newValue ? (
                            <span className="bg-emerald-100/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded font-bold border border-emerald-200/50">
                              {change.newValue}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            change.severity === 'critical' ? 'bg-red-100 text-critical' :
                            change.severity === 'warning' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {change.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card bg-surface-container-lowest border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center space-y-4">
          <ArrowRightLeft size={48} className="text-on-surface-variant animate-pulse" />
          <h3 className="text-sm font-bold text-on-surface">No Active Comparison Run</h3>
          <p className="text-xs text-on-surface-variant max-w-[320px]">
            Configure and select the baseline and current SCADA telemetry spreadsheets above to run the comparison audit engine.
          </p>
        </div>
      )}
    </div>
  );
}
