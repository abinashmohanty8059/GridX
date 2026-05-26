import React from 'react';
import { Info, Code, Shield, Network, Server } from 'lucide-react';

export default function About() {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-on-surface">About GridX</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">System information and software details</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        <div className="glass-card p-6 rounded-xl border border-border">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-lg shadow-md">
              <Network size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">GridX SCADA Telemetry Suite</h3>
              <p className="text-xs text-on-surface-variant">Version 0.1.0 (Enterprise Edition)</p>
            </div>
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
            GridX is a modern industrial SCADA, IEC104 signal monitoring, validation, and analytics platform.
            Engineered specifically for electrical substations, RTUs, and signal mapping workflows to ensure
            data integrity and operational reliability.
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border-light text-sm">
              <span className="text-on-surface font-medium flex items-center gap-2"><Code size={16} className="text-primary"/> Frontend</span>
              <span className="text-on-surface-variant font-mono text-xs">React + Tauri</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border-light text-sm">
              <span className="text-on-surface font-medium flex items-center gap-2"><Server size={16} className="text-success"/> Backend</span>
              <span className="text-on-surface-variant font-mono text-xs">Rust Core Processing</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border-light text-sm">
              <span className="text-on-surface font-medium flex items-center gap-2"><Shield size={16} className="text-warning"/> License</span>
              <span className="text-on-surface-variant font-mono text-xs">Industrial Enterprise License</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}