use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Signal {
    pub id: String,
    pub sl_no: i32,
    pub feeder_name: String,
    pub description: String,
    pub source: String,
    pub iec61850_node: String,
    pub protocol: String,
    #[serde(rename = "type")]
    pub signal_type: String, // maps to type: SignalType in TS
    pub status0: String,
    pub status1: String,
    pub iec104_address: String, // maps to iec104Address in TS
    pub remarks: String,
    pub state: String,
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ValidationIssue {
    pub id: String,
    #[serde(rename = "type")]
    pub issue_type: String, // "duplicate_iec104", "missing_mapping", "rtu_failure", etc.
    pub severity: String, // "critical", "warning", "info"
    pub signal_id: String,
    pub feeder_name: String,
    pub description: String, // maps to description in TS
    pub field: String,
    pub value: String,
    pub suggestion: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DashboardMetrics {
    pub total_signals: usize,
    pub status0_on: usize,
    pub status1_on: usize,
    pub duplicates: usize,
    pub missing_mappings: usize,
    pub offline_signals: usize,
    pub signal_distribution: HashMap<String, usize>,
    pub protocol_distribution: HashMap<String, usize>,
    pub rtu_failures: usize,
    pub validation_issue_count: usize,
    pub recent_changes: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub id: String,
    pub severity: String, // "critical", "warning", "info"
    pub title: String,
    pub message: String,
    pub timestamp: String,
    pub signal_name: String, // maps to signalName via camelCase
    pub feeder_name: String, // maps to feederName via camelCase
    pub transition: String,
    pub acknowledged: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcessedData {
    pub signals: Vec<Signal>,
    pub issues: Vec<ValidationIssue>,
    pub metrics: DashboardMetrics,
    pub alerts: Vec<Alert>,
}

// --- Comparison Engine Models ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SignalChange {
    pub signal_name: String,
    pub feeder_name: String,
    pub change_type: String, // "new", "removed", "status_change", "iec_change", "node_change", "protocol_change"
    pub old_value: String,
    pub new_value: String,
    pub severity: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonSummary {
    pub total_compared_signals: usize,
    pub added_signals: usize,
    pub removed_signals: usize,
    pub status_changes: usize,
    pub iec_changes: usize,
    pub node_changes: usize,
    pub protocol_changes: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonResult {
    pub previous_file: String,
    pub current_file: String,
    pub changes: Vec<SignalChange>,
    pub summary: ComparisonSummary,
}

// --- History Engine Models ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEvent {
    pub timestamp: String,
    pub signal: String,
    pub feeder: String,
    pub old_state: String,
    pub new_state: String,
    pub severity: String,
    pub category: String,
}
