import React from 'react';
import ReactECharts from 'echarts-for-react';

interface ChartCardProps {
  title: string;
  subtitle: string;
  option: any;
  height: string;
  className?: string;
}

export default function ChartCard({ title, subtitle, option, height, className = '' }: ChartCardProps) {
  return (
    <div className={`glass-card p-5 bg-surface-container-lowest border border-border rounded-xl flex flex-col ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-on-surface tracking-tight">{title}</h3>
        <p className="text-[11px] text-on-surface-variant mt-0.5">{subtitle}</p>
      </div>
      <div className="flex-1 w-full" style={{ height }}>
        <ReactECharts 
          option={option} 
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </div>
    </div>
  );
}
