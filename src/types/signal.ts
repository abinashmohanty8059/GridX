// GridX Signal Types — IEC104 / SCADA signal mapping structures

export type SignalType = 'SPI' | 'DPI' | 'SPC' | 'DPC' | 'MEAS' | 'HW';
export type SignalState = 'ON' | 'OFF' | 'OFFLINE' | 'UNKNOWN';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type ValidationType =
  | 'duplicate_iec104'
  | 'missing_mapping'
  | 'invalid_status'
  | 'empty_field'
  | 'rtu_failure'
  | 'invalid_config';

export interface Signal {
  id: string;
  slNo: number;
  feederName: string;
  description: string;
  source: string;
  iec61850Node: string;
  protocol: string; // DPI / SPI / DPC / SPC
  type: SignalType;
  status0: string;
  status1: string;
  iec104Address: string;
  remarks: string;
  state: SignalState;
  lastUpdated: string;
}

export interface ValidationIssue {
  id: string;
  type: ValidationType;
  severity: AlertSeverity;
  signalId: string;
  feederName: string;
  description: string;
  field: string;
  value: string;
  suggestion: string;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  signalName: string;
  feederName: string;
  transition: string;
  acknowledged: boolean;
}

export interface ReportRecord {
  id: string;
  name: string;
  type: 'dashboard' | 'validation' | 'iec104' | 'alerts' | 'summary';
  generatedAt: string;
  status: 'ready' | 'generating' | 'failed';
}

export interface AppSettings {
  exportFolder: string;
  enableDuplicateCheck: boolean;
  enableMissingMappingCheck: boolean;
  enableInvalidStatusCheck: boolean;
  enableEmptyFieldCheck: boolean;
  enableRtuFailureDetection: boolean;
  iec104RangeStart: number;
  iec104RangeEnd: number;
  alertSoundEnabled: boolean;
  autoPdfExport: boolean;
}

export type PageId =
  | 'dashboard'
  | 'validation'
  | 'iec104'
  | 'alerts'
  | 'reports'
  | 'export'
  | 'settings'
  | 'about';
