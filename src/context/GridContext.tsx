import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Signal, Alert, ValidationIssue } from '../types/signal';

interface GridContextType {
  signals: Signal[];
  alerts: Alert[];
  validationIssues: ValidationIssue[];
  acknowledgeAlert: (id: string) => void;
  fileName: string;
  loadExcel: (path: string) => Promise<void>;
  isLoading: boolean;
  triggerUpload: () => Promise<void>;
}

const GridContext = createContext<GridContextType | undefined>(undefined);

export function GridProvider({ children }: { children: ReactNode }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [fileName, setFileName] = useState<string>('No file loaded');
  const [isLoading, setIsLoading] = useState(false);

  const acknowledgeAlert = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const loadExcel = async (path: string) => {
    try {
      setIsLoading(true);
      
      // Extract filename from path
      const name = path.split('\\').pop()?.split('/').pop() || 'Unknown File';
      setFileName(name);

      // Invoke the Rust backend!
      const data: any = await invoke('process_excel_file', { path });
      
      setSignals(data.signals || []);
      setAlerts(data.alerts || []);
      setValidationIssues(data.issues || []);
      
    } catch (error) {
      console.error("Failed to process Excel file:", error);
      // Fallback or error handling
    } finally {
      setIsLoading(false);
    }
  };

  const triggerUpload = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selectedPath = await open({
        multiple: false,
        filters: [{
          name: 'Excel Files',
          extensions: ['xlsx', 'xls']
        }]
      });

      if (selectedPath && typeof selectedPath === 'string') {
        await loadExcel(selectedPath);
      }
    } catch (err) {
      console.error("Failed to open file dialog", err);
    }
  };

  return (
    <GridContext.Provider value={{ signals, alerts, validationIssues, acknowledgeAlert, fileName, loadExcel, isLoading, triggerUpload }}>
      {children}
    </GridContext.Provider>
  );
}

export function useGrid() {
  const context = useContext(GridContext);
  if (context === undefined) {
    throw new Error('useGrid must be used within a GridProvider');
  }
  return context;
}