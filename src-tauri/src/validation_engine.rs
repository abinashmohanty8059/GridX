use crate::models::{Signal, ValidationIssue};
use std::collections::HashMap;

pub fn validate_signals(signals: &[Signal]) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();
    let mut iec104_seen: HashMap<String, Vec<String>> = HashMap::new(); // address -> signal_ids
    let mut next_issue_id = 1;

    let allowed_protocols = ["SPI", "DPI", "DPC", "SPC", "MEAS"];

    for s in signals {
        // Collect for V1 (Duplicate Address)
        let addr = s.iec104_address.trim();
        if !addr.is_empty() {
            iec104_seen.entry(addr.to_string())
                .or_insert_with(Vec::new)
                .push(s.id.clone());
        }

        // V2: Missing IEC61850 Node (Warning)
        if s.iec61850_node.trim().is_empty() {
            issues.push(ValidationIssue {
                id: format!("v{}", next_issue_id),
                issue_type: "missing_mapping".to_string(), // maps to category
                severity: "warning".to_string(),
                signal_id: s.id.clone(),
                feeder_name: s.feeder_name.clone(),
                description: "IEC61850 Node is empty".to_string(),
                field: "iec61850Node".to_string(),
                value: "".to_string(),
                suggestion: "Configure a valid logical node path (e.g. XCBR1.Pos.stVal)".to_string(),
            });
            next_issue_id += 1;
        }

        // V3: Missing IEC104 Address (Warning)
        if addr.is_empty() {
            issues.push(ValidationIssue {
                id: format!("v{}", next_issue_id),
                issue_type: "missing_mapping".to_string(),
                severity: "warning".to_string(),
                signal_id: s.id.clone(),
                feeder_name: s.feeder_name.clone(),
                description: "IEC104 Address is missing".to_string(),
                field: "iec104Address".to_string(),
                value: "".to_string(),
                suggestion: "Assign a unique telemetry address for mapping".to_string(),
            });
            next_issue_id += 1;
        }

        // V4: Invalid Status Combination (ON+ON is Warning)
        // Note: OFF+OFF is not invalid, it represents OFFLINE.
        let s0 = s.status0.trim().to_uppercase();
        let s1 = s.status1.trim().to_uppercase();
        if s0 == "ON" && s1 == "ON" {
            issues.push(ValidationIssue {
                id: format!("v{}", next_issue_id),
                issue_type: "invalid_status".to_string(),
                severity: "warning".to_string(),
                signal_id: s.id.clone(),
                feeder_name: s.feeder_name.clone(),
                description: "Invalid status configuration: Status 0 and Status 1 are both ON".to_string(),
                field: "status0/status1".to_string(),
                value: "ON/ON".to_string(),
                suggestion: "Provide distinct status descriptions for open/close configurations".to_string(),
            });
            next_issue_id += 1;
        }

        // V5: Unknown Protocol (Warning)
        let prot = s.protocol.trim().to_uppercase();
        if !s.protocol.is_empty() && !allowed_protocols.iter().any(|&p| prot.contains(p)) {
            issues.push(ValidationIssue {
                id: format!("v{}", next_issue_id),
                issue_type: "invalid_config".to_string(),
                severity: "warning".to_string(),
                signal_id: s.id.clone(),
                feeder_name: s.feeder_name.clone(),
                description: format!("Unknown SCADA protocol: {}", s.protocol),
                field: "protocol".to_string(),
                value: s.protocol.clone(),
                suggestion: "Verify if protocol is standard SPI, DPI, DPC, SPC or MEAS".to_string(),
            });
            next_issue_id += 1;
        }
    }

    // Process V1: Duplicate IEC104
    for (addr, sig_ids) in iec104_seen {
        if sig_ids.len() > 1 {
            for id in sig_ids {
                if let Some(s) = signals.iter().find(|sig| sig.id == id) {
                    issues.push(ValidationIssue {
                        id: format!("v{}", next_issue_id),
                        issue_type: "duplicate_iec104".to_string(),
                        severity: "critical".to_string(),
                        signal_id: s.id.clone(),
                        feeder_name: s.feeder_name.clone(),
                        description: format!("Duplicate IEC104 address: {} is already mapped", addr),
                        field: "iec104Address".to_string(),
                        value: addr.clone(),
                        suggestion: "Assign a unique IEC104 telemetry address".to_string(),
                    });
                    next_issue_id += 1;
                }
            }
        }
    }

    issues
}
