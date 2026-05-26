import React from 'react';
import { Sliders, BellRing, Database } from 'lucide-react';

export default function Settings() {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-on-surface">System Settings</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">Configure validation rules and system preferences</p>
      </div>

      <div className="max-w-3xl space-y-6">
        <div className="glass-card p-5 rounded-xl border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Sliders size={18} className="text-primary" />
            <h3 className="text-sm font-bold text-on-surface">Validation Rules</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface">Strict IEC104 Duplicate Check</p>
                <p className="text-xs text-on-surface-variant">Prevent identical addresses across all feeders.</p>
              </div>
              <input type="checkbox" className="toggle-checkbox" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface">IEC61850 Node Verification</p>
                <p className="text-xs text-on-surface-variant">Flag missing or malformed node mappings.</p>
              </div>
              <input type="checkbox" className="toggle-checkbox" defaultChecked />
            </div>
          </div>
        </div>

        <div className="glass-card p-5 rounded-xl border border-border">
          <div className="flex items-center gap-2 mb-4">
            <BellRing size={18} className="text-primary" />
            <h3 className="text-sm font-bold text-on-surface">Alert Preferences</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface">RTU Offline Notifications</p>
                <p className="text-xs text-on-surface-variant">Emit critical alert on comm loss.</p>
              </div>
              <input type="checkbox" className="toggle-checkbox" defaultChecked />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
