import { useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import {
  Bell,
  CheckCheck,
  Search,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock
} from 'lucide-react';
import type { AlertSeverity } from '../types/signal';

export default function AlertsConsole() {
  const { alerts, acknowledgeAlert, acknowledgeAllAlerts } = useGrid();
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'acknowledged'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && !alert.acknowledged) ||
        (filterStatus === 'acknowledged' && alert.acknowledged);

      const matchSearch =
        alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.feederName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.signalName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchSeverity && matchStatus && matchSearch;
    });
  }, [alerts, filterSeverity, filterStatus, searchQuery]);

  // 2. Summary stats
  const stats = useMemo(() => {
    const total = alerts.length;
    const active = alerts.filter((a) => !a.acknowledged).length;
    const critical = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;
    const warning = alerts.filter((a) => a.severity === 'warning' && !a.acknowledged).length;

    return { total, active, critical, warning };
  }, [alerts]);

  return (
    // Force light theme on this page regardless of dark mode
    <div className="flex-1 flex flex-col h-screen overflow-y-auto p-container space-y-6 animate-fade-in"
      style={{ background: '#f7f9fb', color: '#191c1e' }}>
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight" style={{ color: '#191c1e' }}>Substation Alerts &amp; Alarm History</h2>
          <p className="text-xs mt-0.5" style={{ color: '#404752' }}>
            Real-time telemetry event tracking, threshold crossings, and RTU connection failures.
          </p>
        </div>
        <div className="flex gap-2">
          {stats.active > 0 && (
            <button
              onClick={acknowledgeAllAlerts}
              className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success/90 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <CheckCheck size={15} />
              Acknowledge All
            </button>
          )}
        </div>
      </div>

      {/* Alarm Status Grid — all 4 cards use the same dark premium style */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Logged Events */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-white shadow-md">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">Total Logged Events</span>
            <span className="text-2xl font-bold font-mono">{stats.total}</span>
          </div>
          <div className="p-2 rounded bg-slate-800 text-slate-400">
            <Clock size={20} />
          </div>
        </div>

        {/* Active Critical Alarms */}
        <div className="p-4 bg-slate-900 border border-red-900/50 rounded-xl flex items-center justify-between text-white shadow-md">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-wider uppercase text-red-400 block">Active Critical Alarms</span>
            <span className="text-2xl font-bold font-mono text-red-400">{stats.critical}</span>
          </div>
          <div className="p-2 rounded bg-red-950/60 text-red-400 animate-pulse">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Active Warnings */}
        <div className="p-4 bg-slate-900 border border-amber-900/40 rounded-xl flex items-center justify-between text-white shadow-md">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-wider uppercase text-amber-400 block">Active Warnings</span>
            <span className="text-2xl font-bold font-mono text-amber-400">{stats.warning}</span>
          </div>
          <div className="p-2 rounded bg-amber-950/50 text-amber-400">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Pending Acks */}
        <div className="p-4 bg-slate-900 border border-blue-900/40 rounded-xl flex items-center justify-between text-white shadow-md">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-wider uppercase text-blue-400 block">Pending Acks</span>
            <span className="text-2xl font-bold font-mono text-blue-400">{stats.active}</span>
          </div>
          <div className="p-2 rounded bg-blue-950/50 text-blue-400">
            <Bell size={20} />
          </div>
        </div>
      </div>

      {/* Main Console Area */}
      <div className="rounded-xl border p-5 flex flex-col space-y-4 shadow-sm"
        style={{ background: '#ffffff', borderColor: '#E2E8F0' }}>
        
        {/* Filtering Options */}
        <div className="flex flex-col md:flex-row justify-between gap-4 border-b pb-4" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex flex-wrap gap-2">
            {/* Status Selectors */}
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              All Statuses
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === 'active'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Unacknowledged ({stats.active})
            </button>
            <button
              onClick={() => setFilterStatus('acknowledged')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === 'acknowledged'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Acknowledged ({stats.total - stats.active})
            </button>

            <span className="h-6 w-px bg-slate-200 self-center mx-1"></span>

            {/* Severity Selectors */}
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterSeverity === 'all'
                  ? 'bg-slate-200 text-slate-800'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              All Severities
            </button>
            <button
              onClick={() => setFilterSeverity('critical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterSeverity === 'critical'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setFilterSeverity('warning')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterSeverity === 'warning'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Warning
            </button>
            <button
              onClick={() => setFilterSeverity('info')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterSeverity === 'info'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Info
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search alarm journal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs w-[260px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 shadow-sm text-slate-800"
            />
          </div>
        </div>

        {/* Live Alarm Log */}
        <div className="space-y-2.5">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              <CheckCircle className="text-emerald-500 mx-auto mb-2" size={32} />
              No events found. System telemetry is within normal bounds.
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border flex items-start justify-between gap-4 text-xs transition-all ${
                  alert.acknowledged
                    ? 'bg-slate-50 border-slate-200 opacity-70'
                    : alert.severity === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : alert.severity === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex gap-3">
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      alert.severity === 'critical'
                        ? 'bg-red-100 text-red-600'
                        : alert.severity === 'warning'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {alert.severity === 'critical' || alert.severity === 'warning' ? (
                      <AlertTriangle size={18} />
                    ) : (
                      <Info size={18} />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{alert.title}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${
                          alert.severity === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : alert.severity === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      {alert.acknowledged && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                          ACKNOWLEDGED
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs">{alert.message}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2 font-mono flex-wrap">
                      <span>Feeder: <strong className="text-slate-600 font-sans">{alert.feederName}</strong></span>
                      <span>•</span>
                      <span>Signal: <strong className="text-slate-600 font-sans">{alert.signalName}</strong></span>
                      {alert.transition !== 'N/A' && (
                        <>
                          <span>•</span>
                          <span>Transition: <strong className="text-slate-700 font-mono bg-slate-100 px-1 py-0.2 rounded">{alert.transition}</strong></span>
                        </>
                      )}
                      <span>•</span>
                      <span>Time: <strong className="text-slate-600">{new Date(alert.timestamp).toLocaleString()}</strong></span>
                    </div>
                  </div>
                </div>

                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-500 hover:text-emerald-600 rounded-lg shadow-sm transition-all shrink-0"
                  >
                    <CheckCheck size={14} />
                    Acknowledge
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
