use crate::models::{Signal, ValidationIssue, Alert};
use chrono::Utc;

pub fn generate_alerts(signals: &[Signal], issues: &[ValidationIssue]) -> Vec<Alert> {
    let mut alerts = Vec::new();
    let mut next_alert_id = 1;

    let rtu_keywords = [
        "rtu communication status",
        "communication health",
        "link status",
        "heartbeat",
        "rtu health"
    ];

    // 1. Telemetry offline & RTU Failure alerts
    for s in signals {
        if s.state == "OFFLINE" {
            let desc_lower = s.description.to_lowercase();
            let is_rtu_fail = rtu_keywords.iter().any(|&kw| desc_lower.contains(kw));

            if is_rtu_fail {
                alerts.push(Alert {
                    id: format!("a{}", next_alert_id),
                    severity: "critical".to_string(),
                    title: "RTU Failure Detected".to_string(),
                    message: format!("RTU communication failure detected on feeder {}", s.feeder_name),
                    timestamp: Utc::now().to_rfc3339(),
                    signal_name: s.description.clone(),
                    feeder_name: s.feeder_name.clone(),
                    transition: "ON -> OFFLINE".to_string(),
                    acknowledged: false,
                });
                next_alert_id += 1;
            } else {
                alerts.push(Alert {
                    id: format!("a{}", next_alert_id),
                    severity: "warning".to_string(),
                    title: "Communication Lost".to_string(),
                    message: format!("Communication link lost on signal: {}", s.description),
                    timestamp: Utc::now().to_rfc3339(),
                    signal_name: s.description.clone(),
                    feeder_name: s.feeder_name.clone(),
                    transition: "ON -> OFFLINE".to_string(),
                    acknowledged: false,
                });
                next_alert_id += 1;
            }
        }
    }

    // 2. Alerts based on validation engine findings (V1 Duplicate Address & V3 Missing Mapping)
    let mut reported_duplicates = std::collections::HashSet::new();
    for issue in issues {
        if issue.issue_type == "duplicate_iec104" {
            let addr = &issue.value;
            if !reported_duplicates.contains(addr) {
                reported_duplicates.insert(addr.clone());
                alerts.push(Alert {
                    id: format!("a{}", next_alert_id),
                    severity: "critical".to_string(),
                    title: "Duplicate IEC104 Address".to_string(),
                    message: format!("Duplicate address conflict detected for address: {}", addr),
                    timestamp: Utc::now().to_rfc3339(),
                    signal_name: issue.description.clone(),
                    feeder_name: issue.feeder_name.clone(),
                    transition: "N/A".to_string(),
                    acknowledged: false,
                });
                next_alert_id += 1;
            }
        } else if issue.issue_type == "missing_mapping" && issue.field == "iec104Address" {
            alerts.push(Alert {
                id: format!("a{}", next_alert_id),
                severity: "warning".to_string(),
                title: "Missing Mapping".to_string(),
                message: format!("Signal description: '{}' on feeder '{}' is missing its telemetry address mapping.", issue.description, issue.feeder_name),
                timestamp: Utc::now().to_rfc3339(),
                signal_name: issue.description.clone(),
                feeder_name: issue.feeder_name.clone(),
                transition: "N/A".to_string(),
                acknowledged: false,
            });
            next_alert_id += 1;
        }
    }

    alerts
}
