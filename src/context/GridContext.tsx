import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Signal, Alert, ValidationIssue } from '../types/signal';

interface GridContextType {
  signals: Signal[];
  alerts: Alert[];
  validationIssues: ValidationIssue[];
  acknowledgeAlert: (id: string) => void;
  fileName: string;
}

const GridContext = createContext<GridContextType | undefined>(undefined);

const SAMPLE_SIGNALS: Signal[] = [
  { id: 's1', slNo: 1, feederName: '33kV Feeder-1', description: 'CB Status', source: 'Bay Controller', iec61850Node: 'XCBR1.Pos.stVal', protocol: 'DPI', type: 'DPI', status0: 'OPEN', status1: 'CLOSE', iec104Address: '1001', remarks: 'Main CB', state: 'ON', lastUpdated: '2026-05-26T01:30:00Z' },
  { id: 's2', slNo: 2, feederName: '33kV Feeder-1', description: 'Earth Switch', source: 'Bay Controller', iec61850Node: 'XSWI2.Pos.stVal', protocol: 'DPI', type: 'DPI', status0: 'OPEN', status1: 'CLOSE', iec104Address: '1003', remarks: '', state: 'OFF', lastUpdated: '2026-05-26T01:28:00Z' },
  { id: 's3', slNo: 3, feederName: '33kV Feeder-2', description: 'CB Status', source: 'Bay Controller', iec61850Node: 'XCBR1.Pos.stVal', protocol: 'DPI', type: 'DPI', status0: 'OPEN', status1: 'CLOSE', iec104Address: '1006', remarks: '', state: 'ON', lastUpdated: '2026-05-26T01:30:00Z' },
  { id: 's4', slNo: 4, feederName: '33kV Feeder-3', description: 'Isolator', source: 'Bay Controller', iec61850Node: 'XSWI1.Pos.stVal', protocol: 'DPI', type: 'DPI', status0: 'OPEN', status1: 'CLOSE', iec104Address: '1011', remarks: '', state: 'OFFLINE', lastUpdated: '2026-05-26T00:45:00Z' },
];

export function GridProvider({ children }: { children: ReactNode }) {
  const [signals, setSignals] = useState<Signal[]>(SAMPLE_SIGNALS);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const fileName = 'Substation_Config_v2.xlsx';

  const acknowledgeAlert = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  return (
    <GridContext.Provider value={{ signals, alerts, validationIssues, acknowledgeAlert, fileName }}>
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