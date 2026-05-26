import React, { useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { 
  FileSpreadsheet, 
  Search, 
  Download, 
  Upload,
  RefreshCw,
  Info,
  Database,
  Grid
} from 'lucide-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Mock Constants Sheet Data
const CONSTANTS_DATA = [
  { parameterName: 'RTU_TIMEOUT_MS', value: '5000', description: 'Maximum RTU response latency boundary', status: 'ACTIVE' },
  { parameterName: 'RETRY_COUNT', value: '3', description: 'TCP connection retries before triggering alarm', status: 'ACTIVE' },
  { parameterName: 'IEC104_PORT', value: '2404', description: 'Standard TCP port allocated for telemetry loops', status: 'ACTIVE' },
  { parameterName: 'MAX_CONNECTIONS', value: '5', description: 'Concurrent substation client link capacity', status: 'ACTIVE' },
  { parameterName: 'SCAN_CYCLE_SEC', value: '2', description: 'Periodic polling cycle frequency', status: 'ACTIVE' },
  { parameterName: 'HEARTBEAT_SEC', value: '15', description: 'IEC-104 Test Frame transmission timer', status: 'ACTIVE' }
];

// Mock Status Codes Sheet Data
const CODES_DATA = [
  { code: '00', type: 'CB_OPEN', description: 'Circuit breaker position indicator: Open', severity: 'INFO' },
  { code: '01', type: 'CB_CLOSE', description: 'Circuit breaker position indicator: Closed', severity: 'INFO' },
  { code: '02', type: 'CB_TRIPPED', description: 'Circuit breaker protection relay tripped', severity: 'CRITICAL' },
  { code: '10', type: 'SW_OPEN', description: 'Disconnecting earth switch status: Open', severity: 'INFO' },
  { code: '11', type: 'SW_CLOSE', description: 'Disconnecting earth switch status: Closed', severity: 'INFO' },
  { code: '99', type: 'COMM_LOSS', description: 'RTU telemetry link offline or power failure', severity: 'CRITICAL' }
];

export default function ExcelViewer() {
  const { signals, fileName, triggerUpload, isLoading } = useGrid();
  const [activeTab, setActiveTab] = useState<'feeders' | 'constants' | 'codes'>('feeders');
  const [gridSearch, setGridSearch] = useState('');

  // 1. Column Definitions for each sheet
  const feederColumns: ColDef[] = useMemo(() => [
    { field: 'slNo', headerName: 'SL No', width: 85, sortable: true, filter: true },
    { field: 'feederName', headerName: 'Feeder Name', width: 160, sortable: true, filter: true },
    { field: 'description', headerName: 'Signal Description', width: 230, sortable: true, filter: true },
    { field: 'source', headerName: 'Source Device', width: 140, sortable: true, filter: true },
    { field: 'iec61850Node', headerName: 'IEC61850 Node Path', width: 210, sortable: true, filter: true },
    { field: 'type', headerName: 'Signal Type', width: 120, sortable: true, filter: true },
    { field: 'status0', headerName: 'Status 0 (OFF)', width: 130, sortable: true, filter: true },
    { field: 'status1', headerName: 'Status 1 (ON)', width: 130, sortable: true, filter: true },
    { field: 'iec104Address', headerName: 'IEC104 Addr', width: 135, sortable: true, filter: true },
    { field: 'remarks', headerName: 'Engineering Remarks', width: 180, sortable: true, filter: true },
    { field: 'state', headerName: 'Telemetry State', width: 130, sortable: true, filter: true },
    { field: 'lastUpdated', headerName: 'Last Updated', width: 185, sortable: true, filter: true },
  ], []);

  const constantsColumns: ColDef[] = useMemo(() => [
    { field: 'parameterName', headerName: 'Parameter Name', width: 220, sortable: true, filter: true },
    { field: 'value', headerName: 'Configured Value', width: 160, sortable: true, filter: true },
    { field: 'description', headerName: 'System Description', width: 380, sortable: true, filter: true },
    { field: 'status', headerName: 'Registry Status', width: 150, sortable: true, filter: true }
  ], []);

  const codesColumns: ColDef[] = useMemo(() => [
    { field: 'code', headerName: 'Status Code', width: 140, sortable: true, filter: true },
    { field: 'type', headerName: 'Telemetry Type', width: 200, sortable: true, filter: true },
    { field: 'description', headerName: 'State Meaning', width: 400, sortable: true, filter: true },
    { field: 'severity', headerName: 'Alarm Severity', width: 160, sortable: true, filter: true }
  ], []);

  // 2. Select data based on active sheet tab
  const gridData = useMemo(() => {
    if (activeTab === 'feeders') return signals;
    if (activeTab === 'constants') return CONSTANTS_DATA;
    return CODES_DATA;
  }, [activeTab, signals]);

  const activeColumns = useMemo(() => {
    if (activeTab === 'feeders') return feederColumns;
    if (activeTab === 'constants') return constantsColumns;
    return codesColumns;
  }, [activeTab, feederColumns, constantsColumns, codesColumns]);

  // 3. Export CSV utility
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let name = '';

    if (activeTab === 'feeders') {
      headers = ['SL No', 'Feeder Name', 'Signal Description', 'Source', 'IEC61850 Node', 'Type', 'Status 0', 'Status 1', 'IEC104 Address', 'Remarks', 'State'];
      rows = signals.map((s) => [
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
      name = `excel_sheet_feeders_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (activeTab === 'constants') {
      headers = ['Parameter Name', 'Value', 'Description', 'Status'];
      rows = CONSTANTS_DATA.map((c) => [c.parameterName, c.value, c.description, c.status]);
      name = `excel_sheet_constants_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      headers = ['Status Code', 'Telemetry Type', 'Description', 'Severity'];
      rows = CODES_DATA.map((c) => [c.code, c.type, c.description, c.severity]);
      name = `excel_sheet_status_codes_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface">
      {/* Excel Meta & Title Header */}
      <div className="bg-surface-container-lowest border-b border-border px-container py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700 shadow-inner flex items-center justify-center shrink-0">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface tracking-tight">Excel Telemetry Viewer</h2>
              <span className="text-[10px] bg-surface-container text-on-surface-variant font-bold px-2 py-0.5 rounded-full font-mono uppercase">
                Active Workbook
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1.5">
              <span className="font-semibold text-on-surface">{fileName}</span> 
              <span>•</span>
              <span>{signals.length} total SCADA signals loaded</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
              <RefreshCw size={14} className="animate-spin text-primary" />
              Parsing Excel...
            </div>
          )}
          <button
            onClick={triggerUpload}
            className="flex items-center gap-2 px-3.5 py-1.8 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Upload size={14} />
            Import Excel Sheet
          </button>
        </div>
      </div>

      {/* Spreadsheet Toolbar */}
      <div className="bg-surface-container-low border-b border-border px-container py-3 flex items-center justify-between gap-4">
        {/* Workbook Sheets Selector tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-lg">
          <button
            onClick={() => { setActiveTab('feeders'); setGridSearch(''); }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'feeders'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Database size={13} />
            Feeder Configs
          </button>
          <button
            onClick={() => { setActiveTab('constants'); setGridSearch(''); }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'constants'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Info size={13} />
            System Constants
          </button>
          <button
            onClick={() => { setActiveTab('codes'); setGridSearch(''); }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'codes'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Grid size={13} />
            Status Codes
          </button>
        </div>

        {/* Toolbar Utility Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-on-surface-variant" size={14} />
            <input
              type="text"
              placeholder="Search current sheet cells..."
              value={gridSearch}
              onChange={(e) => setGridSearch(e.target.value)}
              className="pl-9 pr-4 py-1.8 text-xs w-[240px] bg-surface-container-lowest text-on-surface border border-border rounded-lg focus:outline-none focus:border-primary shadow-sm"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.8 bg-surface-container-lowest hover:bg-surface-container border border-border text-xs font-semibold text-on-surface-variant rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Grid Spreadsheet Area */}
      <div className="flex-1 w-full p-container overflow-hidden">
        <div className="ag-theme-alpine w-full h-full rounded-xl overflow-hidden border border-border shadow-md">
          <AgGridReact
            rowData={gridData}
            columnDefs={activeColumns}
            quickFilterText={gridSearch}
            pagination={true}
            paginationPageSize={20}
            paginationPageSizeSelector={[20, 50, 100]}
            animateRows={true}
            theme="legacy"
            rowSelection={{ mode: 'singleRow' }}
          />
        </div>
      </div>

      {/* Workbook Bottom Status Bar */}
      <div className="bg-[#107C41] border-t border-[#0b5c2f] px-container py-1.5 flex items-center justify-between text-white text-[10px] font-semibold tracking-wider font-mono">
        <div className="flex items-center gap-3">
          <span className="uppercase">Ready</span>
          <span>•</span>
          <span>Sheet: {activeTab === 'feeders' ? 'Feeder Configs' : activeTab === 'constants' ? 'System Constants' : 'Status Codes'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>GridX Sheet Renderer v1.0</span>
        </div>
      </div>
    </div>
  );
}
