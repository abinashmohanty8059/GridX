import { useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { useTheme } from '../context/ThemeContext';
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
  const { isDarkMode } = useTheme();
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'acknowledged'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  const stats = useMemo(() => {
    const total = alerts.length;
    const active = alerts.filter((a) => !a.acknowledged).length;
    const critical = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;
    const warning = alerts.filter((a) => a.severity === 'warning' && !a.acknowledged).length;
    return { total, active, critical, warning };
  }, [alerts]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">Substation Alerts &amp; Alarm History</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
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

      {/* Alarm Status Grid — theme-adaptive cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Logged Events */}
        <div className={`p-4 rounded-xl flex items-center justify-between shadow-md border ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-surface-container-lowest border-border text-on-surface'
        }`}>
          <div className="space-y-1">
            <span className={`text-[10px] font-bold tracking-wider uppercase block ${
              isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'
            }`}>Total Logged Events</span>
            <span className="text-2xl font-bold font-mono">{stats.total}</span>
          </div>
          <div className={`p-2 rounded ${
            isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-surface-container text-on-surface-variant'
          }`}>
            <Clock size={20} />
          </div>
        </div>

        {/* Active Critical Alarms */}
        <div className={`p-4 rounded-xl flex items-center justify-between shadow-md border ${
          isDarkMode
            ? 'bg-slate-900 border-red-900/50 text-white'
            : 'bg-red-50 border-red-200 text-on-surface'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-wider uppercase text-red-500 block">Active Critical Alarms</span>
            <span className="text-2xl font-bold font-mono text-red-500">{stats.critical}</span>
          </div>
          <div className={`p-2 rounded animate-pulse ${
            isDarkMode ? 'bg-red-950/60 text-red-400' : 'bg-red-100 text-red-600'
          }`}>
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Active Warnings */}
        <div className={`p-4 rounded-xl flex items-center justify-between shadow-md border ${
          isDarkMode
            ? 'bg-slate-900 border-amber-900/40 text-white'
            : 'bg-amber-50 border-amber-200 text-on-surface'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-wider uppercase text-amber-500 block">Active Warnings</span>
            <span className="text-2xl font-bold font-mono text-amber-500">{stats.warning}</span>
          </div>
          <div className={`p-2 rounded ${
            isDarkMode ? 'bg-amber-950/50 text-amber-400' : 'bg-amber-100 text-amber-600'
          }`}>
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Pending Acks */}
        <div className={`p-4 rounded-xl flex items-center justify-between shadow-md border ${
          isDarkMode
            ? 'bg-slate-900 border-blue-900/40 text-white'
            : 'bg-blue-50 border-blue-200 text-on-surface'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-wider uppercase text-blue-500 block">Pending Acks</span>
            <span className="text-2xl font-bold font-mono text-blue-500">{stats.active}</span>
          </div>
          <div className={`p-2 rounded ${
            isDarkMode ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-100 text-blue-600'
          }`}>
            <Bell size={20} />
          </div>
        </div>
      </div>

      {/* Main Console Area */}
      <div className="glass-card bg-surface-container-lowest border border-border rounded-xl p-5 flex flex-col space-y-4">
        {/* Filtering Options */}
        <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-border pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
              }`}
            >
              All Statuses
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === 'active'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
              }`}
            >
              Unacknowledged ({stats.active})
            </button>
            <button
              onClick={() => setFilterStatus('acknowledged')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === 'acknowledged'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
              }`}
            >
              Acknowledged ({stats.total - stats.active})
            </button>

            <span className="h-6 w-px bg-border self-center mx-1"></span>

            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterSeverity === 'all'
                  ? 'bg-surface-container-high text-on-surface'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              All Severities
            </button>
            <button
              onClick={() => setFilterSeverity('critical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterSeverity === 'critical'
                  ? 'bg-critical/10 text-critical border border-critical/20'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setFilterSeverity('warning')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterSeverity === 'warning'
                  ? 'bg-warning/10 text-warning border border-warning/20'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Warning
            </button>
            <button
              onClick={() => setFilterSeverity('info')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterSeverity === 'info'
                  ? 'bg-info/10 text-info border border-info/20'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Info
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-on-surface-variant" size={16} />
            <input
              type="text"
              placeholder="Search alarm journal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs w-[260px] bg-surface-container-lowest text-on-surface border border-border rounded-lg focus:outline-none focus:border-primary shadow-sm"
            />
          </div>
        </div>

        {/* Live Alarm Log */}
        <div className="space-y-2.5">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-xs text-on-surface-variant">
              <CheckCircle className="text-success mx-auto mb-2" size={32} />
              No events found. System telemetry is within normal bounds.
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border flex items-start justify-between gap-4 text-xs transition-all ${
                  alert.acknowledged
                    ? 'bg-surface-container/50 border-border opacity-70'
                    : alert.severity === 'critical'
                    ? 'bg-critical/5 border-critical/20'
                    : alert.severity === 'warning'
                    ? 'bg-warning/5 border-warning/20'
                    : 'bg-info/5 border-info/20'
                }`}
              >
                <div className="flex gap-3">
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      alert.severity === 'critical'
                        ? 'bg-critical/10 text-critical'
                        : alert.severity === 'warning'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-info/10 text-info'
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
                      <span className="font-bold text-on-surface text-sm">{alert.title}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${
                          alert.severity === 'critical'
                            ? 'bg-critical/15 text-critical'
                            : alert.severity === 'warning'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-info/15 text-info'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      {alert.acknowledged && (
                        <span className="text-[10px] text-success bg-success/10 px-2 py-0.5 rounded-full font-bold border border-success/20">
                          ACKNOWLEDGED
                        </span>
                      )}
                    </div>
                    <p className="text-on-surface-variant text-xs">{alert.message}</p>
                    <div className="flex items-center gap-3 text-[10px] text-on-surface-variant mt-2 font-mono flex-wrap">
                      <span>Feeder: <strong className="text-on-surface-variant font-sans">{alert.feederName}</strong></span>
                      <span>•</span>
                      <span>Signal: <strong className="text-on-surface-variant font-sans">{alert.signalName}</strong></span>
                      {alert.transition !== 'N/A' && (
                        <>
                          <span>•</span>
                          <span>Transition: <strong className="text-on-surface font-mono bg-surface-container px-1 py-0.2 rounded">{alert.transition}</strong></span>
                        </>
                      )}
                      <span>•</span>
                      <span>Time: <strong className="text-on-surface-variant">{new Date(alert.timestamp).toLocaleString()}</strong></span>
                    </div>
                  </div>
                </div>

                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest hover:bg-surface-container border border-border text-[11px] font-bold text-on-surface-variant hover:text-success rounded-lg shadow-sm transition-all shrink-0"
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
