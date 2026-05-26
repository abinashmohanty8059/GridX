use serde::{Deserialize, Serialize};

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
    pub type_name: String,
    pub status0: String,
    pub status1: String,
    pub iec104: i32,
    pub remarks: String,
    pub state: String,
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ValidationIssue {
    pub id: String,
    pub issue_type: String, // e.g. "duplicate_iec104", "missing_mapping"
    pub message: String,
    pub severity: String, // "critical", "warning"
    pub signal_id: Option<String>,
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
    pub signal_distribution: std::collections::HashMap<String, usize>,
    pub protocol_distribution: std::collections::HashMap<String, usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub id: String,
    pub timestamp: String,
    pub severity: String, // "Critical", "Warning", "Info"
    pub alert_type: String,
    pub message: String,
    pub signal: String,
    pub feeder: String,
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
