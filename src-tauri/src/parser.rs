use crate::models::{ProcessedData, Signal, ValidationIssue, DashboardMetrics, Alert};
use std::collections::HashMap;
use chrono::Utc;
use log::info;

pub fn mock_process_excel(path: &str) -> Result<ProcessedData, String> {
    info!("Processing Excel file from path: {}", path);
    // In a real implementation, calamine would read the file here.
    // For now, we construct the required response based on the PRD schema.
    
    let signal = Signal {
        id: "s1".to_string(),
        sl_no: 1,
        feeder_name: "MAHANGA-1".to_string(),
        description: "Breaker Open Status".to_string(),
        source: "RTU-01".to_string(),
        iec61850_node: "XCBR.Pos.stVal".to_string(),
        protocol: "DPI".to_string(),
        type_name: "Hardware".to_string(),
        status0: "ON".to_string(),
        status1: "OFF".to_string(),
        iec104: 101,
        remarks: "OK".to_string(),
        state: "ON".to_string(),
        last_updated: Utc::now().to_rfc3339(),
    };

    let signal2 = Signal {
        id: "s2".to_string(),
        sl_no: 2,
        feeder_name: "MAHANGA-1".to_string(),
        description: "RTU Communication Status".to_string(),
        source: "RTU-01".to_string(),
        iec61850_node: "".to_string(), // Missing node -> Rule 5 Warning
        protocol: "SPI".to_string(),
        type_name: "Software".to_string(),
        status0: "ON".to_string(),
        status1: "OFF".to_string(),
        iec104: 101, // Duplicate -> Rule 2 Critical
        remarks: "Check mapping".to_string(),
        state: "OFF".to_string(),
        last_updated: Utc::now().to_rfc3339(),
    };

    let signals = vec![signal, signal2];

    let mut sig_dist = HashMap::new();
    sig_dist.insert("ON".to_string(), 1);
    sig_dist.insert("OFF".to_string(), 1);

    let mut prot_dist = HashMap::new();
    prot_dist.insert("DPI".to_string(), 1);
    prot_dist.insert("SPI".to_string(), 1);

    let metrics = DashboardMetrics {
        total_signals: 2,
        status0_on: 2,
        status1_on: 0,
        duplicates: 1,
        missing_mappings: 1,
        offline_signals: 1,
        signal_distribution: sig_dist,
        protocol_distribution: prot_dist,
    };

    let issue = ValidationIssue {
        id: "i1".to_string(),
        issue_type: "duplicate_iec104".to_string(),
        message: "IEC104 Address 101 duplicated".to_string(),
        severity: "critical".to_string(),
        signal_id: Some("s2".to_string()),
    };
    
    let issue2 = ValidationIssue {
        id: "i2".to_string(),
        issue_type: "missing_mapping".to_string(),
        message: "IEC61850 Node missing".to_string(),
        severity: "warning".to_string(),
        signal_id: Some("s2".to_string()),
    };

    let alert = Alert {
        id: "a1".to_string(),
        timestamp: Utc::now().to_rfc3339(),
        severity: "Critical".to_string(),
        alert_type: "Duplicate IEC104".to_string(),
        message: format!("Loaded file {}: IEC104 Address 101 duplicated", path),
        signal: "RTU Communication Status".to_string(),
        feeder: "MAHANGA-1".to_string(),
        acknowledged: false,
    };

    Ok(ProcessedData {
        signals,
        issues: vec![issue, issue2],
        metrics,
        alerts: vec![alert],
    })
}
