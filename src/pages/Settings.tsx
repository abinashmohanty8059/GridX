import { Sliders, BellRing, Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-surface p-container space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-on-surface">System Settings</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">Configure validation rules and system preferences</p>
      </div>

      <div className="max-w-3xl space-y-6">

        {/* ── Appearance Card ───────────────────────────────────────────── */}
        <div className="glass-card p-5 rounded-xl border border-border">
          <div className="flex items-center gap-2 mb-4">
            {isDarkMode
              ? <Moon size={18} className="text-primary" />
              : <Sun size={18} className="text-primary" />
            }
            <h3 className="text-sm font-bold text-on-surface">Appearance</h3>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Theme preview chips */}
              <div className="flex items-center gap-2">
                {/* Light chip */}
                <button
                  onClick={() => isDarkMode && toggleDarkMode()}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all cursor-pointer ${
                    !isDarkMode
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-border/60'
                  }`}
                >
                  <div className="w-12 h-8 rounded bg-white border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-3 h-full bg-slate-800" />
                    <div className="absolute top-1.5 left-4 right-1 h-1 rounded bg-slate-200" />
                    <div className="absolute top-3.5 left-4 right-2 h-1 rounded bg-slate-100" />
                  </div>
                  <span className={`text-[10px] font-semibold ${!isDarkMode ? 'text-primary' : 'text-on-surface-variant'}`}>
                    Light
                  </span>
                </button>

                {/* Dark chip */}
                <button
                  onClick={() => !isDarkMode && toggleDarkMode()}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all cursor-pointer ${
                    isDarkMode
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-border/60'
                  }`}
                >
                  <div className="w-12 h-8 rounded bg-[#0f1117] border border-slate-700 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-3 h-full bg-[#0D1B2A]" />
                    <div className="absolute top-1.5 left-4 right-1 h-1 rounded bg-slate-600" />
                    <div className="absolute top-3.5 left-4 right-2 h-1 rounded bg-slate-700" />
                  </div>
                  <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-primary' : 'text-on-surface-variant'}`}>
                    Dark
                  </span>
                </button>
              </div>

              <div>
                <p className="text-sm font-medium text-on-surface">Theme Mode</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Currently using <span className="font-semibold">{isDarkMode ? 'Dark' : 'Light'}</span> theme
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              id="dark-mode-toggle"
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
              className={`relative w-14 h-7 rounded-full border-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer ${
                isDarkMode
                  ? 'bg-primary border-primary'
                  : 'bg-slate-200 border-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
                  isDarkMode
                    ? 'translate-x-7 bg-white text-primary'
                    : 'translate-x-0 bg-white text-slate-500'
                }`}
              >
                {isDarkMode
                  ? <Moon size={10} />
                  : <Sun size={10} />
                }
              </span>
            </button>
          </div>

          {/* Subtle hint */}
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-surface-container border border-border-light text-xs text-on-surface-variant">
            <Monitor size={13} className="shrink-0 text-primary" />
            <span>Theme preference is saved locally and will persist across sessions.</span>
          </div>
        </div>

        {/* ── Validation Rules Card ─────────────────────────────────────── */}
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

        {/* ── Alert Preferences Card ────────────────────────────────────── */}
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
