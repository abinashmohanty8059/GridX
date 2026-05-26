import { useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Radio,
  FileSpreadsheet,
  Cpu,
  Search,
  Bell,
  Check
} from 'lucide-react';
import type { Signal } from '../types/signal';

export default function Dashboard() {
  const { signals, alerts, validationIssues, acknowledgeAlert, fileName, triggerUpload } = useGrid();
  const [searchTerm, setSearchTerm] = useState('');

  // 1. KPI Counts
  const totalCount = signals.length;
  const activeCount = signals.filter((s) => s.state === 'ON').length;
  const offlineCount = signals.filter((s) => s.state === 'OFFLINE').length;
  const duplicateCount = validationIssues.filter((vi) => vi.type === 'duplicate_iec104').length;
  const missingCount = validationIssues.filter((vi) => vi.type === 'missing_mapping').length;
  const rtuFailures = validationIssues.filter((vi) => vi.type === 'rtu_failure').length;

  // 2. Active Alert panel (unacknowledged alerts)
  const activeAlerts = useMemo(() => {
    return alerts.filter((a) => !a.acknowledged).slice(0, 5);
  }, [alerts]);

  // 3. Filtered Signals for Table
  const filteredSignals = useMemo(() => {
    if (!searchTerm.trim()) return signals;
    const term = searchTerm.toLowerCase();
    return signals.filter(
      (s) =>
        s.feederName.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.iec104Address.toLowerCase().includes(term) ||
        s.iec61850Node.toLowerCase().includes(term)
    );
  }, [signals, searchTerm]);

  // 4. Chart Configuration 1: Signal State Donut Chart
  const stateChartOption = useMemo(() => {
    const on = signals.filter((s) => s.state === 'ON').length;
    const off = signals.filter((s) => s.state === 'OFF').length;
    const offline = signals.filter((s) => s.state === 'OFFLINE').length;
    const unknown = signals.filter((s) => s.state === 'UNKNOWN').length;

    return {
      tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: '0%', left: 'center', textStyle: { color: '#475569', fontSize: 11 } },
      color: ['#10B981', '#64748B', '#EF4444', '#F59E0B'],
      series: [
        {
          name: 'Signal States',
          type: 'pie' as const,
          radius: ['45%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 13,
              fontWeight: 'bold',
              formatter: '{b}\n{c}',
            },
          },
          data: [
            { value: on, name: 'ON (Active Telemetry)' },
            { value: off, name: 'OFF (Idle State)' },
            { value: offline, name: 'OFFLINE (Comm Fail)' },
            { value: unknown, name: 'UNKNOWN' },
          ],
        },
      ],
    };
  }, [signals]);

  // 5. Chart Configuration 2: Signal Types Bar Chart
  const typeChartOption = useMemo(() => {
    const types = ['SPI', 'DPI', 'SPC', 'DPC', 'MEAS', 'HW'];
    const counts = types.map((t) => signals.filter((s) => s.type === t).length);

    return {
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
      grid: { left: '3%', right: '4%', bottom: '8%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: types,
        axisLabel: { color: '#64748B', fontSize: 11 },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748B', fontSize: 11 },
        splitLine: { lineStyle: { color: '#E2E8F0' } }
      },
      series: [
        {
          name: 'Signal Count',
          type: 'bar',
          data: counts,
          itemStyle: { color: '#3B82F6', borderRadius: [4, 4, 0, 0] }
        }
      ]
    };
  }, [signals]);

  // 6. Table Column Definitions
  const columnDefs = useMemo<ColDef<Signal>[]>(() => {
    return [
      { field: 'feederName', headerName: 'Feeder', width: 160, sortable: true },
      { field: 'description', headerName: 'Description', flex: 1, sortable: true },
      { 
        field: 'type', 
        headerName: 'Type', 
        width: 100, 
        sortable: true,
        cellRenderer: (params: any) => {
          const val = params.value;
          let badgeColor = 'bg-slate-50 text-slate-700 border border-slate-200';
          if (val === 'DPI' || val === 'SPI') badgeColor = 'bg-blue-50 text-blue-700 border border-blue-100';
          if (val === 'MEAS') badgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
          if (val === 'HW') badgeColor = 'bg-amber-50 text-amber-700 border border-amber-100';
          return `<span class="px-2 py-0.5 rounded text-[11px] font-bold ${badgeColor}">${val}</span>`;
        },
      },
      {
        field: 'iec104Address',
        headerName: 'IEC104 Addr',
        width: 130,
        sortable: true,
        cellClass: 'data-mono text-center',
        cellRenderer: (params: any) => {
          const addr = params.value;
          if (!addr) return '<span class="text-critical font-semibold">MISSING</span>';
          return `<span class="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono">${addr}</span>`;
        },
      },
      { field: 'iec61850Node', headerName: 'IEC61850 Path', width: 240, sortable: true, cellClass: 'data-mono font-mono text-xs' },
      {
        field: 'state',
        headerName: 'Telemetry State',
        width: 140,
        sortable: true,
        cellRenderer: (params: any) => {
          const state = params.value;
          if (state === 'ON') {
            return `<div class="flex items-center gap-1.5"><span class="status-led status-led-online"></span><span class="text-success font-medium text-xs">ON</span></div>`;
          } else if (state === 'OFFLINE') {
            return `<div class="flex items-center gap-1.5"><span class="status-led status-led-offline"></span><span class="text-critical font-medium text-xs">OFFLINE</span></div>`;
          } else {
            return `<div class="flex items-center gap-1.5"><span class="status-led status-led-warning"></span><span class="text-on-surface-variant font-medium text-xs">OFF</span></div>`;
          }
        },
      },
      { field: 'remarks', headerName: 'Remarks', width: 200 },
    ];
  }, []);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      {/* Top Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">Substation SCADA Telemetry</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Loaded File: <span className="font-semibold text-primary">{fileName}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={triggerUpload}
            className="flex items-center gap-2 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:bg-primary-container transition-colors"
          >
            <Activity size={16} /> {/* Can use a better icon like Upload later */}
            Upload Excel Mapping
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-on-surface-variant" size={16} />
            <input
              type="text"
              placeholder="Search signals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs w-[260px] bg-white border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <KPICard
          title="Total Signals"
          value={totalCount}
          icon={FileSpreadsheet}
          colorClass="primary"
          subtitle="IEC104 points mapped"
        />
        <KPICard
          title="Active (ON)"
          value={activeCount}
          icon={Activity}
          colorClass="success"
          subtitle={`${Math.round((activeCount / (totalCount || 1)) * 100)}% active rate`}
        />
        <KPICard
          title="Offline Signals"
          value={offlineCount}
          icon={AlertTriangle}
          colorClass="critical"
          subtitle="Communication fail"
        />
        <KPICard
          title="RTU Failures"
          value={rtuFailures}
          icon={Cpu}
          colorClass="critical"
          subtitle="Feeder communication loss"
        />
        <KPICard
          title="Duplicate Addrs"
          value={duplicateCount}
          icon={AlertTriangle}
          colorClass="warning"
          subtitle="IEC104 conflicts"
        />
        <KPICard
          title="Missing Mappings"
          value={missingCount}
          icon={Radio}
          colorClass="info"
          subtitle="Pending SCADA configs"
        />
      </div>

      {/* Charts & Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Telemetry State Distribution"
          subtitle="Substation active telemetry proportion"
          option={stateChartOption}
          height="220px"
          className="lg:col-span-1"
        />
        <ChartCard
          title="Signal Protocol Type"
          subtitle="Distribution of SPI, DPI, MEAS, and HW indicators"
          option={typeChartOption}
          height="220px"
          className="lg:col-span-1"
        />

        {/* Live Alerts Pane */}
        <div className="glass-card p-5 bg-surface-container-lowest border border-border rounded-xl flex flex-col justify-between h-[310px]">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm font-bold text-on-surface tracking-tight flex items-center gap-1.5">
                <Bell size={16} className="text-critical animate-pulse-glow" />
                Live Substation Alerts
              </h3>
              <p className="text-[11px] text-on-surface-variant">Unacknowledged events feed</p>
            </div>
            {activeAlerts.length > 0 && (
              <span className="text-[10px] bg-critical-light text-critical font-bold px-2 py-0.5 rounded-full">
                {activeAlerts.length} Active
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <CheckCircle size={32} className="text-success mb-2" />
                <p className="text-xs font-semibold text-on-surface">System Normal</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">All alerts acknowledged</p>
              </div>
            ) : (
              activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg border border-border-light bg-slate-50/50 hover:bg-slate-50 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`severity-badge ${
                          alert.severity === 'critical'
                            ? 'severity-critical'
                            : alert.severity === 'warning'
                            ? 'severity-warning'
                            : 'severity-info'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="font-bold text-on-surface">{alert.title}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">{alert.message}</p>
                    <div className="text-[10px] text-on-surface-variant flex items-center gap-1.5 font-mono">
                      <span>{alert.feederName}</span>
                      <span>•</span>
                      <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="p-1 rounded bg-white hover:bg-emerald-50 text-on-surface-variant hover:text-success border border-border transition-colors self-center"
                    title="Acknowledge alert"
                  >
                    <Check size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AG Grid Signal Spreadsheet */}
      <div className="glass-card bg-surface-container-lowest border border-border rounded-xl p-5 flex flex-col space-y-4">
        <div>
          <h3 className="text-sm font-bold text-on-surface tracking-tight">Signal Telemetry Database</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Fully searchable and interactive substation telemetry mapping table
          </p>
        </div>
        <div className="ag-theme-alpine w-full h-[400px] rounded-lg overflow-hidden border border-border shadow-sm">
          <AgGridReact
            rowData={filteredSignals}
            columnDefs={columnDefs}
            pagination={true}
            paginationPageSize={10}
            paginationPageSizeSelector={[10, 20, 50]}
            animateRows={true}
            rowSelection="single"
          />
        </div>
      </div>
    </div>
  );
}

