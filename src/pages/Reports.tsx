import React from 'react';
import { FileText, Download } from 'lucide-react';

export default function Reports() {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-on-surface">Reports & Export Center</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">Manage and generate SCADA telemetry reports</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {[
          { name: "Daily Feeder Status", type: "PDF Report", date: "2026-05-26 08:00" },
          { name: "IEC104 Conflicts Log", type: "CSV Export", date: "2026-05-25 18:30" },
          { name: "RTU Health Check", type: "PDF Report", date: "2026-05-25 12:00" },
        ].map((report, i) => (
          <div key={i} className="glass-card p-4 rounded-xl border border-border flex justify-between items-center hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-primary rounded-lg">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">{report.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-slate-100 px-1.5 py-0.5 rounded">{report.type}</span>
                  <span className="text-[10px] text-on-surface-variant font-mono">{report.date}</span>
                </div>
              </div>
            </div>
            <button className="text-primary hover:text-primary-container p-2 rounded-full hover:bg-blue-50 transition-colors">
              <Download size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
