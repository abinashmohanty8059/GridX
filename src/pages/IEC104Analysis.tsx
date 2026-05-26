import { useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import KPICard from '../components/KPICard';
import {
  Hash,
  CheckCircle,
  AlertTriangle,
  Zap,
  Check,
  Binary
} from 'lucide-react';

export default function IEC104Analysis() {
  const { signals, settings } = useGrid();
  const [addressSearch, setAddressSearch] = useState('');

  // 2. Extrapolate all used addresses and their mappings
  const addressMappings = useMemo(() => {
    const mappings: Record<string, { signals: typeof signals; isCollision: boolean }> = {};

    signals.forEach((s) => {
      if (s.iec104Address) {
        if (!mappings[s.iec104Address]) {
          mappings[s.iec104Address] = { signals: [], isCollision: false };
        }
        mappings[s.iec104Address].signals.push(s);
      }
    });

    // Mark collisions
    Object.keys(mappings).forEach((addr) => {
      if (mappings[addr].signals.length > 1) {
        mappings[addr].isCollision = true;
      }
    });

    return mappings;
  }, [signals]);

  // 3. Address Range statistics
  const rangeStats = useMemo(() => {
    const activeAddresses = Object.keys(addressMappings).map(Number).filter(n => !isNaN(n));
    const minAddr = activeAddresses.length > 0 ? Math.min(...activeAddresses) : settings.iec104RangeStart;
    const maxAddr = activeAddresses.length > 0 ? Math.max(...activeAddresses) : settings.iec104RangeEnd;
    const totalMapped = activeAddresses.length;
    const collisionsCount = Object.values(addressMappings).filter((m) => m.isCollision).length;

    return { minAddr, maxAddr, totalMapped, collisionsCount };
  }, [addressMappings, settings]);

  // 4. Generate representative slots (e.g. from minAddress to minAddress + 49 or settings range)
  // To avoid rendering 10,000 slots, we show the address block around mapped signals.
  const visualSlots = useMemo(() => {
    const base = Math.floor(rangeStats.minAddr / 10) * 10;
    const slots = [];
    // Show 60 slots starting from base address to visualize
    for (let i = 0; i < 60; i++) {
      const addr = (base + i).toString();
      const mapping = addressMappings[addr];
      slots.push({
        address: addr,
        status: mapping
          ? mapping.isCollision
            ? 'collision'
            : 'mapped'
          : 'empty',
        signals: mapping?.signals || [],
      });
    }
    return slots;
  }, [addressMappings, rangeStats]);

  // 5. Check if search address is available
  const availabilityStatus = useMemo(() => {
    if (!addressSearch.trim()) return null;
    const cleanAddr = addressSearch.trim();
    const mapping = addressMappings[cleanAddr];

    if (!mapping) {
      return {
        available: true,
        message: `Address ${cleanAddr} is available for SCADA mapping.`,
      };
    } else if (mapping.isCollision) {
      return {
        available: false,
        collision: true,
        message: `CRITICAL collision: ${cleanAddr} is assigned to ${mapping.signals.map(s => s.description).join(' and ')}.`,
      };
    } else {
      return {
        available: false,
        message: `Assigned: Address ${cleanAddr} is mapped to "${mapping.signals[0].description}" on ${mapping.signals[0].feederName}.`,
      };
    }
  }, [addressSearch, addressMappings]);

  // 6. Filter collisions table
  const collisionList = useMemo(() => {
    return Object.entries(addressMappings)
      .filter(([_, data]) => data.isCollision)
      .map(([addr, data]) => ({
        address: addr,
        signals: data.signals,
      }));
  }, [addressMappings]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-on-surface">IEC104 Addressing & Registry</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Review address allocations, verify registry alignment, and resolve collisions on the substation network.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Registered Addresses"
          value={rangeStats.totalMapped}
          icon={Hash}
          colorClass="primary"
          subtitle={`Range: ${rangeStats.minAddr} - ${rangeStats.maxAddr}`}
        />
        <KPICard
          title="Active Collisions"
          value={rangeStats.collisionsCount}
          icon={AlertTriangle}
          colorClass={rangeStats.collisionsCount > 0 ? 'critical' : 'success'}
          subtitle="Overlapping telemetry links"
        />
        <KPICard
          title="Registry Utilization"
          value={`${Math.round((rangeStats.totalMapped / (settings.iec104RangeEnd - settings.iec104RangeStart + 1)) * 10000) / 100}%`}
          icon={Binary}
          colorClass="info"
          subtitle={`Configured limit: ${settings.iec104RangeEnd}`}
        />
        <KPICard
          title="Validation Integrity"
          value={rangeStats.collisionsCount === 0 ? '100%' : `${Math.round(((rangeStats.totalMapped - rangeStats.collisionsCount) / rangeStats.totalMapped) * 100)}%`}
          icon={CheckCircle}
          colorClass={rangeStats.collisionsCount === 0 ? 'success' : 'warning'}
          subtitle="Non-overlapping addressing"
        />
      </div>

      {/* Main Analysis Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Address Availability Checker & Recommendations */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="glass-card p-5 bg-surface-container-lowest border border-border rounded-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-on-surface tracking-tight">Address Check Utility</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Test address assignments or check network slots</p>
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-semibold text-on-surface-variant label-caps block">IEC104 Address</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="e.g. 1006"
                  value={addressSearch}
                  onChange={(e) => setAddressSearch(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:border-primary shadow-sm font-mono"
                />
              </div>
              {availabilityStatus && (
                <div
                  className={`p-3 rounded-lg border text-xs flex gap-2 items-start ${
                    availabilityStatus.available
                      ? 'bg-emerald-50 border-emerald-200 text-success'
                      : availabilityStatus.collision
                      ? 'bg-red-50 border-red-200 text-critical font-medium'
                      : 'bg-amber-50 border-amber-200 text-[#92400E]'
                  }`}
                >
                  {availabilityStatus.available ? <Check size={16} /> : <AlertTriangle size={16} />}
                  <span className="leading-snug">{availabilityStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-5 bg-surface-container-lowest border border-border rounded-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-on-surface tracking-tight">Address Assignment Guide</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Substation default protocol ranges</p>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg border border-border-light bg-slate-50">
                <span className="font-semibold text-on-surface">1000 - 1999</span>
                <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">STATUS (DPI/SPI)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg border border-border-light bg-slate-50">
                <span className="font-semibold text-on-surface">2000 - 2999</span>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">MEASUREMENT (MEAS)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg border border-border-light bg-slate-50">
                <span className="font-semibold text-on-surface">3000 - 3999</span>
                <span className="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded text-[10px]">COMMANDS (SPC/DPC)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg border border-border-light bg-slate-50">
                <span className="font-semibold text-on-surface">4000+</span>
                <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">SYSTEM ALARMS (HW)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Registry Map */}
        <div className="lg:col-span-2 glass-card p-5 bg-surface-container-lowest border border-border rounded-xl flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-on-surface tracking-tight flex items-center gap-1.5">
                <Zap size={16} className="text-primary" />
                Telemetry Registry Space
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Visual block representing slots around address {Math.floor(rangeStats.minAddr / 10) * 10}
              </p>
            </div>
            {/* Visual Legend */}
            <div className="flex gap-3 text-[10px] font-semibold label-caps text-on-surface-variant">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded"></span> Mapped
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-critical rounded"></span> Collision
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-slate-200 rounded"></span> Empty
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 md:grid-cols-10 gap-2 p-2 border border-border-light rounded-lg bg-slate-50">
            {visualSlots.map((slot) => {
              let color = 'bg-slate-200 text-slate-500 hover:bg-slate-300';
              let border = 'border-transparent';
              if (slot.status === 'mapped') {
                color = 'bg-emerald-500 text-white hover:bg-emerald-600';
              } else if (slot.status === 'collision') {
                color = 'bg-critical text-white hover:bg-critical/90 animate-pulse';
                border = 'border-red-400';
              }

              return (
                <div
                  key={slot.address}
                  title={`Address: ${slot.address}\n${
                    slot.signals.length > 0
                      ? slot.signals.map((s) => `${s.feederName}: ${s.description}`).join('\n')
                      : 'Unmapped'
                  }`}
                  className={`h-11 flex flex-col justify-center items-center rounded text-[11px] font-semibold cursor-pointer border ${border} ${color} transition-all font-mono shadow-sm`}
                >
                  <span>{slot.address}</span>
                  {slot.signals.length > 1 && (
                    <span className="text-[8px] bg-white text-critical rounded px-0.5 font-sans mt-0.5 font-bold">
                      ERR
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Collisions Report Panel */}
          <div className="pt-4 border-t border-border-light flex-1">
            <h4 className="text-xs font-bold text-on-surface tracking-tight mb-3 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-warning" />
              Active Addressing Collisions ({collisionList.length})
            </h4>
            <div className="space-y-2 overflow-y-auto max-h-[160px] pr-1">
              {collisionList.length === 0 ? (
                <div className="text-center py-4 text-xs text-on-surface-variant">
                  No active address collisions detected. All mappings are unique!
                </div>
              ) : (
                collisionList.map((col) => (
                  <div
                    key={col.address}
                    className="p-3 rounded-lg border border-red-200 bg-red-50/30 flex justify-between items-start gap-4 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-critical bg-red-100 px-2 py-0.5 rounded text-xs mr-2">
                        {col.address}
                      </span>
                      <span className="font-semibold text-on-surface">Overlap Conflict</span>
                      <div className="mt-1 space-y-1 text-[11px] text-on-surface-variant pl-3 border-l-2 border-red-300">
                        {col.signals.map((s, idx) => (
                          <div key={idx}>
                            • <span className="font-semibold">{s.feederName}</span> — {s.description}{' '}
                            <span className="font-mono text-[10px] text-on-surface-variant">({s.source})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
