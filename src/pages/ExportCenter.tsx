
import { useGrid } from '../context/GridContext';
import {
  Download,
  FileSpreadsheet,
  AlertTriangle,
  History,
  Printer,
  FileDown
} from 'lucide-react';

export default function ExportCenter() {
  const { signals, validationIssues, alerts } = useGrid();

  // Helper function to trigger browser downloads
  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTelemetry = () => {
    const headers = ['SL No', 'Feeder Name', 'Signal Description', 'Source', 'IEC61850 Node', 'Type', 'Status 0', 'Status 1', 'IEC104 Address', 'Remarks', 'State'];
    const rows = signals.map((s) => [
      s.slNo.toString(),
      s.feederName,
      s.description,
      s.source,
      s.iec61850Node,
      s.type,
      s.status0,
      s.status1,
      s.iec104Address,
      s.remarks,
      s.state,
    ]);
    downloadCSV(`scada_telemetry_export_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handleExportValidation = () => {
    const headers = ['Issue ID', 'Severity', 'Feeder Name', 'Signal Description', 'Field Name', 'Current Value', 'Proposed Suggestion'];
    const rows = validationIssues.map((vi) => [
      vi.id,
      vi.severity.toUpperCase(),
      vi.feederName,
      vi.description,
      vi.field,
      vi.value,
      vi.suggestion,
    ]);
    downloadCSV(`scada_validation_issues_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handleExportAlerts = () => {
    const headers = ['Alert ID', 'Severity', 'Title', 'Message', 'Signal Name', 'Feeder Name', 'Timestamp', 'Acknowledged'];
    const rows = alerts.map((a) => [
      a.id,
      a.severity.toUpperCase(),
      a.title,
      a.message,
      a.signalName,
      a.feederName,
      a.timestamp,
      a.acknowledged ? 'TRUE' : 'FALSE',
    ]);
    downloadCSV(`scada_alarms_journal_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-on-surface">Substation Export Center</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Download SCADA configurations, telemetry spreadsheets, anomaly journals, or compile print-ready PDFs.
        </p>
      </div>

      {/* Grid of Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Telemetry Database */}
        <div className="glass-card p-6 bg-surface-container-lowest border border-border rounded-xl flex flex-col justify-between h-[200px]">
          <div className="flex gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary self-start">
              <FileSpreadsheet size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-on-surface">Telemetry Database (CSV)</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Download the complete active SCADA database. Includes signals, logical nodes, protocol settings, and active states.
              </p>
            </div>
          </div>
          <button
            onClick={handleExportTelemetry}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Download size={14} />
            Export Telemetry ({signals.length} rows)
          </button>
        </div>

        {/* Card 2: Validation Anomalies */}
        <div className="glass-card p-6 bg-surface-container-lowest border border-border rounded-xl flex flex-col justify-between h-[200px]">
          <div className="flex gap-4">
            <div className="p-3 rounded-lg bg-warning/10 text-warning self-start">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-on-surface">Validation Anomalies (CSV)</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Download a listing of all identified address conflicts, missing mappings, and empty configuration fields.
              </p>
            </div>
          </div>
          <button
            onClick={handleExportValidation}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Download size={14} />
            Export Validation Journal ({validationIssues.length} anomalies)
          </button>
        </div>

        {/* Card 3: Alerts Log */}
        <div className="glass-card p-6 bg-surface-container-lowest border border-border rounded-xl flex flex-col justify-between h-[200px]">
          <div className="flex gap-4">
            <div className="p-3 rounded-lg bg-critical/10 text-critical self-start">
              <History size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-on-surface">Alarms & Events History (CSV)</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Export the historical list of events, state transitions, and unacknowledged alerts on the substation loop.
              </p>
            </div>
          </div>
          <button
            onClick={handleExportAlerts}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Download size={14} />
            Export Alarm Log ({alerts.length} events)
          </button>
        </div>

        {/* Card 4: Printable PDF */}
        <div className="glass-card p-6 bg-surface-container-lowest border border-border rounded-xl flex flex-col justify-between h-[200px]">
          <div className="flex gap-4">
            <div className="p-3 rounded-lg bg-info/10 text-info self-start">
              <Printer size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-on-surface">Print Telemetry Review (PDF)</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Prepare and compile a clean, print-ready document formatting the telemetry spreadsheet and validation dashboard.
              </p>
            </div>
          </div>
          <button
            onClick={handlePrintReport}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <FileDown size={14} />
            Print Substation Overview
          </button>
        </div>
      </div>
    </div>
  );
}
