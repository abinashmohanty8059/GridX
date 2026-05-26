
import { AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';
import KPICard from '../components/KPICard';

export default function ValidationCenter() {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">Validation Center</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">Detect engineering issues in uploaded signal lists.</p>
        </div>
        <button className="bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:bg-primary-container transition-colors">
          Export Validation Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="IEC104 Conflicts" value={3} icon={AlertOctagon} colorClass="critical" subtitle="Duplicate addresses detected" />
        <KPICard title="Missing Node Mappings" value={12} icon={ShieldAlert} colorClass="warning" subtitle="IEC61850 Paths missing" />
        <KPICard title="Valid Signals" value={450} icon={CheckCircle2} colorClass="success" subtitle="Successfully parsed and mapped" />
      </div>

      <div className="glass-card bg-surface-container-lowest border border-border rounded-xl p-5 mt-6">
        <h3 className="text-sm font-bold text-on-surface tracking-tight mb-4">Pending Validation Issues</h3>
        <div className="text-sm text-on-surface-variant text-center py-10 border border-dashed border-border-light rounded-lg">
          No severe issues require immediate intervention.
        </div>
      </div>
    </div>
  );
}
