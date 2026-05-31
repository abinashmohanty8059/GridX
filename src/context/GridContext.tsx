import { createContext, useContext, useState, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Signal, Alert, ValidationIssue, AppSettings } from '../types/signal';

export interface SignalChange {
  signalName: string;
  feederName: string;
  changeType: string; // "new", "removed", "status_change", "iec_change", "node_change", "protocol_change"
  oldValue: string;
  newValue: string;
  severity: string;
}

export interface ComparisonSummary {
  totalComparedSignals: number;
  addedSignals: number;
  removedSignals: number;
  statusChanges: number;
  iecChanges: number;
  nodeChanges: number;
  protocolChanges: number;
}

export interface ComparisonResult {
  previousFile: string;
  currentFile: string;
  changes: SignalChange[];
  summary: ComparisonSummary;
}

interface GridContextType {
  signals: Signal[];
  alerts: Alert[];
  validationIssues: ValidationIssue[];
  acknowledgeAlert: (id: string) => void;
  acknowledgeAllAlerts: () => void;
  fileName: string;
  loadExcel: (path: string) => Promise<void>;
  isLoading: boolean;
  triggerUpload: () => Promise<void>;
  settings: AppSettings;
  // Comparison Engine features
  comparisonResult: ComparisonResult | null;
  setComparisonResult: (res: ComparisonResult | null) => void;
  compareExcelFiles: (prevPath: string, currPath: string) => Promise<ComparisonResult>;
  triggerSelectFilePath: () => Promise<string | null>;
}

const GridContext = createContext<GridContextType | undefined>(undefined);

export function GridProvider({ children }: { children: ReactNode }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [fileName, setFileName] = useState<string>('No file loaded');
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);

  const [settings] = useState<AppSettings>({
    exportFolder: '',
    enableDuplicateCheck: true,
    enableMissingMappingCheck: true,
    enableInvalidStatusCheck: true,
    enableEmptyFieldCheck: true,
    enableRtuFailureDetection: true,
    iec104RangeStart: 1000,
    iec104RangeEnd: 4999,
    alertSoundEnabled: true,
    autoPdfExport: false,
  });

  const acknowledgeAlert = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const acknowledgeAllAlerts = () => {
    setAlerts(alerts.map(a => ({ ...a, acknowledged: true })));
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

  const triggerSelectFilePath = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selectedPath = await open({
        multiple: false,
        filters: [{
          name: 'Excel Files',
          extensions: ['xlsx', 'xls']
        }]
      });
      return (selectedPath && typeof selectedPath === 'string') ? selectedPath : null;
    } catch (err) {
      console.error("Failed to open file dialog", err);
      return null;
    }
  };

  const compareExcelFiles = async (prevPath: string, currPath: string) => {
    try {
      setIsLoading(true);
      const res = await invoke<ComparisonResult>('compare_excel_files', { prevPath, currPath });
      setComparisonResult(res);
      return res;
    } catch (err) {
      console.error("Failed to compare excel files", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GridContext.Provider value={{
      signals,
      alerts,
      validationIssues,
      acknowledgeAlert,
      acknowledgeAllAlerts,
      fileName,
      loadExcel,
      isLoading,
      triggerUpload,
      settings,
      comparisonResult,
      setComparisonResult,
      compareExcelFiles,
      triggerSelectFilePath
    }}>
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