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
        signal_type: "DPI".to_string(),
        status0: "ON".to_string(),
        status1: "OFF".to_string(),
        iec104_address: "101".to_string(),
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
        signal_type: "SPI".to_string(),
        status0: "ON".to_string(),
        status1: "OFF".to_string(),
        iec104_address: "101".to_string(), // Duplicate -> Rule 2 Critical
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
        severity: "critical".to_string(),
        signal_id: "s2".to_string(),
        feeder_name: "MAHANGA-1".to_string(),
        description: "IEC104 Address 101 duplicated".to_string(),
        field: "iec104Address".to_string(),
        value: "101".to_string(),
        suggestion: "Change IEC104 address to a unique address".to_string(),
    };
    
    let issue2 = ValidationIssue {
        id: "i2".to_string(),
        issue_type: "missing_mapping".to_string(),
        severity: "warning".to_string(),
        signal_id: "s2".to_string(),
        feeder_name: "MAHANGA-1".to_string(),
        description: "IEC61850 Node missing".to_string(),
        field: "iec61850Node".to_string(),
        value: "".to_string(),
        suggestion: "Configure valid IEC61850 logical node path".to_string(),
    };

    let alert = Alert {
        id: "a1".to_string(),
        severity: "critical".to_string(), // lowercase: "critical"
        title: "Duplicate IEC104".to_string(),
        message: format!("Loaded file {}: IEC104 Address 101 duplicated", path),
        timestamp: Utc::now().to_rfc3339(),
        signal_name: "RTU Communication Status".to_string(),
        feeder_name: "MAHANGA-1".to_string(),
        transition: "ON -> OFF".to_string(),
        acknowledged: false,
    };

    Ok(ProcessedData {
        signals,
        issues: vec![issue, issue2],
        metrics,
        alerts: vec![alert],
    })
}
