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
        {/* App Info Card */}
        <div className="glass-card p-6 rounded-xl border border-border flex flex-col justify-between">
          <div>
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
            <div className="space-y-3 mb-6">
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

        {/* Developer Card */}
        <div className="glass-card p-6 rounded-xl border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-600 flex items-center justify-center rounded-lg shadow-md text-white font-bold text-lg">
                AM
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Abinash Mohanty</h3>
                <p className="text-xs text-on-surface-variant font-medium">Lead SCADA Software Engineer</p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
              Core developer of the GridX platform. Responsible for designing the Rust parsing engine, deterministic 
              SCADA validation rules, interactive spreadsheet viewports, and responsive layout architectures.
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="https://www.linkedin.com/in/abinash-mohanty-/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0077B5] hover:bg-[#005e8c] text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn Profile
            </a>
            <a
              href="https://github.com/abinashmohanty8059"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-all border border-slate-700"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
              GitHub Profile
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}