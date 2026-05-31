import { useState, useMemo } from 'react';
import { useGrid } from '../context/GridContext';
import { 
  AlertOctagon, 
  CheckCircle2, 
  ShieldAlert, 
  Search, 
  Download, 
  AlertTriangle, 
  Info,
  ShieldCheck
} from 'lucide-react';
import KPICard from '../components/KPICard';

export default function ValidationCenter() {
  const { signals, validationIssues } = useGrid();
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. KPI Computations
  const iec104Conflicts = useMemo(() => {
    return validationIssues.filter((vi) => vi.type === 'duplicate_iec104').length;
  }, [validationIssues]);

  const missingNodeMappings = useMemo(() => {
    return validationIssues.filter((vi) => vi.type === 'missing_mapping' && vi.field === 'iec61850Node').length;
  }, [validationIssues]);

  const validSignals = useMemo(() => {
    const invalidSignalIds = new Set(validationIssues.map((vi) => vi.signalId));
    return Math.max(0, signals.length - invalidSignalIds.size);
  }, [signals, validationIssues]);

  // 2. Issue Types List
  const issueTypes = useMemo(() => {
    const types = new Set(validationIssues.map((vi) => vi.type));
    return Array.from(types);
  }, [validationIssues]);

  const getIssueTypeLabel = (type: string) => {
    switch (type) {
      case 'duplicate_iec104':
        return 'Duplicate IEC104';
      case 'missing_mapping':
        return 'Missing Mapping';
      case 'invalid_status':
        return 'Invalid Status';
      case 'empty_field':
        return 'Empty Field';
      case 'rtu_failure':
        return 'RTU Failure';
      case 'invalid_config':
        return 'Invalid Config';
      default:
        return type;
    }
  };

  // 3. Filtered Issues list
  const filteredIssues = useMemo(() => {
    return validationIssues.filter((vi) => {
      const matchSeverity = severityFilter === 'all' || vi.severity === severityFilter;
      const matchType = typeFilter === 'all' || vi.type === typeFilter;
      const matchSearch =
        vi.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vi.feederName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vi.field.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vi.suggestion.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vi.value.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSeverity && matchType && matchSearch;
    });
  }, [validationIssues, severityFilter, typeFilter, searchQuery]);

  // 4. CSV Export Logic
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

  const handleExportValidation = () => {
    if (validationIssues.length === 0) return;
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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">Validation Center</h2>
          <p className="text-xs text-on-surface-variant mt-0.5 font-medium">Detect engineering issues in uploaded signal lists.</p>
        </div>
        <button 
          onClick={handleExportValidation}
          disabled={validationIssues.length === 0}
          className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all border ${
            validationIssues.length === 0 
              ? 'bg-slate-200 text-slate-400 border-slate-350 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700' 
              : 'bg-primary text-white border-transparent hover:bg-primary-container hover:shadow cursor-pointer'
          }`}
        >
          <Download size={14} />
          Export Validation Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard 
          title="IEC104 Conflicts" 
          value={iec104Conflicts} 
          icon={AlertOctagon} 
          colorClass={iec104Conflicts > 0 ? 'critical' : 'success'} 
          subtitle="Duplicate addresses detected" 
        />
        <KPICard 
          title="Missing Node Mappings" 
          value={missingNodeMappings} 
          icon={ShieldAlert} 
          colorClass={missingNodeMappings > 0 ? 'warning' : 'success'} 
          subtitle="IEC61850 Paths missing" 
        />
        <KPICard 
          title="Valid Signals" 
          value={validSignals} 
          icon={CheckCircle2} 
          colorClass="success" 
          subtitle="Successfully parsed and mapped" 
        />
      </div>

      <div className="glass-card bg-surface-container-lowest border border-border rounded-xl p-5 mt-6 flex-1 flex flex-col min-h-[400px]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-on-surface tracking-tight">Pending Validation Issues ({filteredIssues.length})</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Filter and review telemetry definition warnings</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-2 text-on-surface-variant" size={14} />
              <input
                type="text"
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs w-full md:w-[200px] bg-surface-container-lowest text-on-surface border border-border rounded-lg focus:outline-none focus:border-primary shadow-sm font-medium"
              />
            </div>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-surface-container-lowest text-on-surface border border-border rounded-lg focus:outline-none focus:border-primary shadow-sm font-medium cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>

            {/* Issue Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-surface-container-lowest text-on-surface border border-border rounded-lg focus:outline-none focus:border-primary shadow-sm font-medium cursor-pointer"
            >
              <option value="all">All Types</option>
              {issueTypes.map((type) => (
                <option key={type} value={type}>
                  {getIssueTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[250px]">
          {filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <ShieldCheck size={48} className="text-success mb-3 animate-pulse" />
              <p className="text-sm font-bold text-on-surface">No Validation Issues Found</p>
              <p className="text-xs text-on-surface-variant mt-1 max-w-[280px]">
                {validationIssues.length === 0 
                  ? 'Please upload an Excel mapping file to run engineering validation checks.'
                  : 'All loaded configurations match the telemetry validation criteria.'}
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-container text-on-surface-variant font-bold border-b border-border">
                    <tr>
                      <th className="p-3 w-[110px]">Severity</th>
                      <th className="p-3 w-[150px]">Feeder Name</th>
                      <th className="p-3">Issue Description</th>
                      <th className="p-3 w-[120px]">Target Field</th>
                      <th className="p-3 w-[100px]">Value</th>
                      <th className="p-3">Proposed Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-container-lowest">
                    {filteredIssues.map((issue) => (
                      <tr key={issue.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              issue.severity === 'critical'
                                ? 'bg-critical-light text-critical border border-critical/20 dark:bg-red-950/40 dark:text-red-400'
                                : issue.severity === 'warning'
                                ? 'bg-warning-light text-warning border border-warning/20 dark:bg-amber-950/40 dark:text-amber-400'
                                : 'bg-blue-50 text-info border border-blue-100 dark:bg-blue-950/40 dark:text-blue-400'
                            }`}
                          >
                            {issue.severity === 'critical' ? (
                              <AlertOctagon size={10} />
                            ) : issue.severity === 'warning' ? (
                              <AlertTriangle size={10} />
                            ) : (
                              <Info size={10} />
                            )}
                            {issue.severity}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-on-surface">{issue.feederName}</td>
                        <td className="p-3 text-on-surface-variant leading-relaxed">{issue.description}</td>
                        <td className="p-3">
                          <code className="text-[10px] font-mono bg-surface-container text-on-surface px-1.5 py-0.5 rounded border border-border-light">
                            {issue.field}
                          </code>
                        </td>
                        <td className="p-3 font-mono">
                          {issue.value ? (
                            <span className="text-[11px] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded font-semibold border border-border-light">
                              {issue.value}
                            </span>
                          ) : (
                            <span className="text-[10px] font-sans font-bold text-critical bg-critical/10 px-1.5 py-0.5 rounded border border-critical/20 dark:bg-red-950/30">
                              MISSING
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-on-surface-variant font-medium bg-surface-container/10 italic">
                          {issue.suggestion}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
