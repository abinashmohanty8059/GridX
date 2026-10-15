import { useState } from 'react';
import { Activity, ArrowRight, Database, Layers, Moon, Network, Sun, Zap } from 'lucide-react';
import { AppMode, useAppMode } from '../context/AppModeContext';
import { useTheme } from '../context/ThemeContext';
import logoImg from '../assets/square-image.jpg';

const OPTIONS: {
  id: AppMode; title: string; subtitle: string; icon: typeof Activity; accent: string;
  points: string[];
}[] = [
  {
    id: 'scada',
    title: 'SCADA Automation',
    subtitle: 'Signal lists, IEC 104 telemetry and validation',
    icon: Zap,
    accent: '#2196f3',
    points: ['Load signal list workbooks', 'Validate IEC 61850 / 104 mapping', 'Alerts, comparison and reports'],
  },
  {
    id: 'de',
    title: 'Data Engineering',
    subtitle: 'Understand a pipeline from its layer definitions',
    icon: Database,
    accent: '#8b5cf6',
    points: ['Upload input, derived and semantic layers', 'See every table and column linked on a canvas', 'Predict semantic & output tables, edit the schema'],
  },
];

export default function ModeSelect() {
  const { chooseMode } = useAppMode();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [remember, setRemember] = useState(false);

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-surface relative">
      <div className="absolute inset-0 pointer-events-none opacity-60"
        style={{ background: 'radial-gradient(800px 400px at 15% 0%, rgba(33,150,243,0.10), transparent), radial-gradient(800px 400px at 85% 100%, rgba(139,92,246,0.10), transparent)' }} />
      <button onClick={toggleDarkMode} title="Toggle theme"
        className="absolute top-5 right-5 p-2 rounded-lg border border-border bg-surface-container-lowest text-on-surface-variant hover:text-on-surface cursor-pointer z-10">
        {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
      </button>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-8 py-16">
        <div className="flex items-center gap-3 mb-10">
          <img src={logoImg} alt="GridX" className="w-11 h-11 rounded-xl object-cover border border-border" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">GridX</h1>
            <p className="text-xs text-on-surface-variant">Choose a workspace to get started</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {OPTIONS.map((o) => (
            <button key={o.id} onClick={() => chooseMode(o.id, remember)}
              className="group text-left glass-card p-6 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${o.accent}1f`, color: o.accent }}>
                  <o.icon size={24} />
                </div>
                <ArrowRight size={18} className="text-on-surface-variant opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
              <h2 className="text-lg font-bold text-on-surface">{o.title}</h2>
              <p className="text-sm text-on-surface-variant mt-1 mb-5">{o.subtitle}</p>
              <ul className="space-y-2">
                {o.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-[13px] text-on-surface">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: o.accent }} />
                    {p}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <label className="mt-8 inline-flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer select-none">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#2196f3]" />
          Remember my choice (you can switch any time from the sidebar)
        </label>

        <div className="mt-14 grid sm:grid-cols-3 gap-4 text-[12px] text-on-surface-variant">
          <div className="flex gap-2"><Layers size={16} className="shrink-0 text-violet-500" />Input → Derived → Semantic → Output, drawn as one connected map.</div>
          <div className="flex gap-2"><Network size={16} className="shrink-0 text-emerald-500" />Hover any column to read its definition; click it to trace where it comes from.</div>
          <div className="flex gap-2"><Activity size={16} className="shrink-0 text-sky-500" />Everything stays on this computer — files are read locally.</div>
        </div>
      </div>
    </div>
  );
}
