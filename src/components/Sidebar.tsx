import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ActivitySquare, 
  AlertTriangle, 
  Settings, 
  FileSpreadsheet,
  Network,
  Info,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import logoImg from '../assets/square-image.jpg';

export default function Sidebar() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const getNavClass = ({ isActive }: { isActive: boolean }) => 
    `sidebar-item group ${isActive ? 'sidebar-item-active' : ''}`;

  return (
    <div className="w-64 h-screen bg-[#0D1B2A] flex flex-col py-6 border-r border-[#1e3450] shrink-0 text-white shadow-xl z-10">
      <div className="px-6 mb-8 flex items-center gap-3">
        <img 
          src={logoImg} 
          alt="GridX Logo" 
          className="w-9 h-9 rounded-lg object-cover border border-[#1e3450]" 
        />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white leading-tight">GridX</h1>
          <p className="text-[10px] text-blue-300/70 font-mono tracking-wider">SCADA TELEMETRY</p>
        </div>
      </div>

      <div className="flex-1 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 mt-4 text-[10px] font-bold uppercase tracking-widest text-blue-200/40">
          Analytics
        </div>
        
        <NavLink to="/" className={getNavClass}>
          <LayoutDashboard size={18} className="text-blue-400 group-hover:text-blue-300 transition-colors" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/alerts" className={getNavClass}>
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-amber-400 group-hover:text-amber-300 transition-colors" />
              <span>Alerts Console</span>
            </div>
            <span className="bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded">3</span>
          </div>
        </NavLink>
        <NavLink to="/validation" className={getNavClass}>
          <ActivitySquare size={18} className="text-emerald-400 group-hover:text-emerald-300 transition-colors" />
          <span>Validation Center</span>
        </NavLink>
        
        <div className="px-3 mb-2 mt-8 text-[10px] font-bold uppercase tracking-widest text-blue-200/40">
          Tools & Reporting
        </div>
        
        <NavLink to="/iec104" className={getNavClass}>
          <Network size={18} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
          <span>IEC 104 Analysis</span>
        </NavLink>
        <NavLink to="/comparison" className={getNavClass}>
          <FileSpreadsheet size={18} className="text-amber-400 group-hover:text-amber-300 transition-colors" />
          <span>Comparison Center</span>
        </NavLink>
        <NavLink to="/excel" className={getNavClass}>
          <FileSpreadsheet size={18} className="text-cyan-400 group-hover:text-cyan-300 transition-colors" />
          <span>Excel Viewer</span>
        </NavLink>
        <NavLink to="/export" className={getNavClass}>
          <FileSpreadsheet size={18} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
          <span>Export Center</span>
        </NavLink>
        <NavLink to="/reports" className={getNavClass}>
          <FileSpreadsheet size={18} className="text-emerald-400 group-hover:text-emerald-300 transition-colors" />
          <span>Reports</span>
        </NavLink>

        <div className="px-3 mb-2 mt-8 text-[10px] font-bold uppercase tracking-widest text-blue-200/40">
          System
        </div>
        <NavLink to="/settings" className={getNavClass}>
          <Settings size={18} className="text-slate-400 group-hover:text-slate-300 transition-colors" />
          <span>Settings</span>
        </NavLink>
        <NavLink to="/about" className={getNavClass}>
          <Info size={18} className="text-slate-400 group-hover:text-slate-300 transition-colors" />
          <span>About GridX</span>
        </NavLink>
      </div>
      
      <div className="px-6 pt-4 mt-auto border-t border-white/5 space-y-3">
        {/* Quick theme toggle */}
        <button
          onClick={toggleDarkMode}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            {isDarkMode
              ? <Moon size={14} className="text-blue-300" />
              : <Sun size={14} className="text-amber-300" />
            }
            <span className="text-[11px] text-white/60 font-medium group-hover:text-white/80 transition-colors">
              {isDarkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <div className={`relative w-8 h-4 rounded-full transition-all duration-300 ${
            isDarkMode ? 'bg-blue-500/60' : 'bg-white/20'
          }`}>
            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all duration-300 ${
              isDarkMode ? 'left-4' : 'left-0.5'
            }`} />
          </div>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
            <span className="text-blue-300 text-xs font-bold">OP</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">Operator Desk 1</p>
            <p className="text-[10px] text-blue-300/60 truncate">Active Session</p>
          </div>
        </div>
      </div>
    </div>
  );
}
