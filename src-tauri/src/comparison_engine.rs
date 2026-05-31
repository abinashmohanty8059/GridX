use crate::models::{Signal, SignalChange, ComparisonResult, ComparisonSummary, Alert};
use std::collections::HashMap;
use chrono::Utc;

pub fn compare_excel_files(
    prev_file_name: &str,
    curr_file_name: &str,
    prev_signals: &[Signal],
    curr_signals: &[Signal],
) -> (ComparisonResult, Vec<Alert>) {
    let mut changes = Vec::new();
    let mut alerts = Vec::new();
    let mut next_alert_id = 2000;

    let mut added_signals = 0;
    let mut removed_signals = 0;
    let mut status_changes = 0;
    let mut iec_changes = 0;
    let mut node_changes = 0;
    let mut protocol_changes = 0;
    let mut total_compared_signals = 0;

    // Group previous signals by (feeder_name, description)
    let mut prev_groups: HashMap<(String, String), Vec<&Signal>> = HashMap::new();
    for s in prev_signals {
        let key = (s.feeder_name.trim().to_lowercase(), s.description.trim().to_lowercase());
        prev_groups.entry(key).or_default().push(s);
    }

    // Group current signals by (feeder_name, description)
    let mut curr_groups: HashMap<(String, String), Vec<&Signal>> = HashMap::new();
    for s in curr_signals {
        let key = (s.feeder_name.trim().to_lowercase(), s.description.trim().to_lowercase());
        curr_groups.entry(key).or_default().push(s);
    }

    // Match and compare
    for (key, curr_list) in &curr_groups {
        match prev_groups.get(key) {
            Some(prev_list) => {
                // Key matches! Now resolve matching of signals in both lists
                let mut matched_prev = vec![false; prev_list.len()];
                let mut matched_curr = vec![false; curr_list.len()];

                // Step 1: Match by Secondary Key (iec104_address)
                for (c_idx, c_sig) in curr_list.iter().enumerate() {
                    for (p_idx, p_sig) in prev_list.iter().enumerate() {
                        if !matched_prev[p_idx] && !c_sig.iec104_address.is_empty() && c_sig.iec104_address == p_sig.iec104_address {
                            matched_curr[c_idx] = true;
                            matched_prev[p_idx] = true;
                            total_compared_signals += 1;
                            compare_signal_pair(p_sig, c_sig, &mut changes, &mut alerts, &mut next_alert_id, &mut status_changes, &mut iec_changes, &mut node_changes, &mut protocol_changes);
                            break;
                        }
                    }
                }

                // Step 2: Match remaining sequentially
                for (c_idx, c_sig) in curr_list.iter().enumerate() {
                    if !matched_curr[c_idx] {
                        for (p_idx, p_sig) in prev_list.iter().enumerate() {
                            if !matched_prev[p_idx] {
                                matched_curr[c_idx] = true;
                                matched_prev[p_idx] = true;
                                total_compared_signals += 1;
                                compare_signal_pair(p_sig, c_sig, &mut changes, &mut alerts, &mut next_alert_id, &mut status_changes, &mut iec_changes, &mut node_changes, &mut protocol_changes);
                                break;
                            }
                        }
                    }
                }

                // Step 3: Any leftover in curr are added
                for (c_idx, c_sig) in curr_list.iter().enumerate() {
                    if !matched_curr[c_idx] {
                        added_signals += 1;
                        changes.push(SignalChange {
                            signal_name: c_sig.description.clone(),
                            feeder_name: c_sig.feeder_name.clone(),
                            change_type: "new".to_string(),
                            old_value: "".to_string(),
                            new_value: c_sig.state.clone(),
                            severity: "info".to_string(),
                        });
                    }
                }

                // Step 4: Any leftover in prev are removed
                for (p_idx, p_sig) in prev_list.iter().enumerate() {
                    if !matched_prev[p_idx] {
                        removed_signals += 1;
                        changes.push(SignalChange {
                            signal_name: p_sig.description.clone(),
                            feeder_name: p_sig.feeder_name.clone(),
                            change_type: "removed".to_string(),
                            old_value: p_sig.state.clone(),
                            new_value: "".to_string(),
                            severity: "info".to_string(),
                        });
                    }
                }
            }
            None => {
                // Feeder+Description key not found in previous: All are added
                for c_sig in curr_list {
                    added_signals += 1;
                    changes.push(SignalChange {
                        signal_name: c_sig.description.clone(),
                        feeder_name: c_sig.feeder_name.clone(),
                        change_type: "new".to_string(),
                        old_value: "".to_string(),
                        new_value: c_sig.state.clone(),
                        severity: "info".to_string(),
                    });
                }
            }
        }
    }

    // Any keys in previous not in current: All are removed
    for (key, prev_list) in &prev_groups {
        if !curr_groups.contains_key(key) {
            for p_sig in prev_list {
                removed_signals += 1;
                changes.push(SignalChange {
                    signal_name: p_sig.description.clone(),
                    feeder_name: p_sig.feeder_name.clone(),
                    change_type: "removed".to_string(),
                    old_value: p_sig.state.clone(),
                    new_value: "".to_string(),
                    severity: "info".to_string(),
                });
            }
        }
    }

    let summary = ComparisonSummary {
        total_compared_signals,
        added_signals,
        removed_signals,
        status_changes,
        iec_changes,
        node_changes,
        protocol_changes,
    };

    let result = ComparisonResult {
        previous_file: prev_file_name.to_string(),
        current_file: curr_file_name.to_string(),
        changes,
        summary,
    };

    (result, alerts)
}

fn compare_signal_pair(
    prev_sig: &Signal,
    curr_sig: &Signal,
    changes: &mut Vec<SignalChange>,
    alerts: &mut Vec<Alert>,
    next_alert_id: &mut usize,
    status_changes: &mut usize,
    iec_changes: &mut usize,
    node_changes: &mut usize,
    protocol_changes: &mut usize,
) {
    // 1. Status changes (State transitions)
    if prev_sig.state != curr_sig.state {
        *status_changes += 1;
        changes.push(SignalChange {
            signal_name: curr_sig.description.clone(),
            feeder_name: curr_sig.feeder_name.clone(),
            change_type: "status_change".to_string(),
            old_value: prev_sig.state.clone(),
            new_value: curr_sig.state.clone(),
            severity: "warning".to_string(),
        });

        alerts.push(Alert {
            id: format!("c{}", *next_alert_id),
            severity: "warning".to_string(),
            title: "Signal State Changed".to_string(),
            message: format!(
                "Signal state for '{}' on feeder '{}' transitioned from '{}' to '{}'",
                curr_sig.description, curr_sig.feeder_name, prev_sig.state, curr_sig.state
            ),
            timestamp: Utc::now().to_rfc3339(),
            signal_name: curr_sig.description.clone(),
            feeder_name: curr_sig.feeder_name.clone(),
            transition: format!("{} -> {}", prev_sig.state, curr_sig.state),
            acknowledged: false,
        });
        *next_alert_id += 1;
    }

    // 2. IEC104 address change
    if prev_sig.iec104_address != curr_sig.iec104_address {
        *iec_changes += 1;
        changes.push(SignalChange {
            signal_name: curr_sig.description.clone(),
            feeder_name: curr_sig.feeder_name.clone(),
            change_type: "iec_change".to_string(),
            old_value: prev_sig.iec104_address.clone(),
            new_value: curr_sig.iec104_address.clone(),
            severity: "info".to_string(),
        });
    }

    // 3. Node path change
    if prev_sig.iec61850_node != curr_sig.iec61850_node {
        *node_changes += 1;
        changes.push(SignalChange {
            signal_name: curr_sig.description.clone(),
            feeder_name: curr_sig.feeder_name.clone(),
            change_type: "node_change".to_string(),
            old_value: prev_sig.iec61850_node.clone(),
            new_value: curr_sig.iec61850_node.clone(),
            severity: "info".to_string(),
        });
    }

    // 4. Protocol change
    if prev_sig.protocol != curr_sig.protocol {
        *protocol_changes += 1;
        changes.push(SignalChange {
            signal_name: curr_sig.description.clone(),
            feeder_name: curr_sig.feeder_name.clone(),
            change_type: "protocol_change".to_string(),
            old_value: prev_sig.protocol.clone(),
            new_value: curr_sig.protocol.clone(),
            severity: "info".to_string(),
        });
    }
}
