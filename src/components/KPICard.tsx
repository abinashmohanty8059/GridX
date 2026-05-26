import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  subtitle: string;
  colorClass: 'primary' | 'success' | 'critical' | 'warning' | 'info';
}

const colorMap = {
  primary: 'text-primary bg-primary-container',
  success: 'text-success bg-emerald-50',
  critical: 'text-critical bg-error-container',
  warning: 'text-warning bg-warning-light',
  info: 'text-info bg-secondary-container'
};

export default function KPICard({ title, value, icon: Icon, subtitle, colorClass }: KPICardProps) {
  return (
    <div className="glass-card kpi-card p-4 rounded-xl flex flex-col justify-between border-border transition-all">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{title}</h3>
        <div className={`p-1.5 rounded-md ${colorMap[colorClass]}`}>
          <Icon size={16} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-on-surface mb-1">{value}</p>
        <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
