use crate::models::{Signal, ValidationIssue, Alert, DashboardMetrics};
use std::collections::HashMap;

pub fn generate_metrics(
    signals: &[Signal],
    issues: &[ValidationIssue],
    alerts: &[Alert],
    recent_changes_count: usize,
) -> DashboardMetrics {
    let mut sig_dist = HashMap::new();
    let mut prot_dist = HashMap::new();

    let mut status0_on = 0; // Represents ON state count
    let mut status1_on = 0; // Represents OFF state count
    let mut offline_signals = 0;

    for s in signals {
        *sig_dist.entry(s.state.clone()).or_insert(0) += 1;
        *prot_dist.entry(s.protocol.clone()).or_insert(0) += 1;

        if s.state == "ON" {
            status0_on += 1;
        } else if s.state == "OFF" {
            status1_on += 1;
        } else if s.state == "OFFLINE" {
            offline_signals += 1;
        }
    }

    let mut duplicates = 0;
    let mut missing_mappings = 0;
    for issue in issues {
        if issue.issue_type == "duplicate_iec104" {
            duplicates += 1;
        } else if issue.issue_type == "missing_mapping" {
            missing_mappings += 1;
        }
    }

    // Count RTU Failures by checking the alerts that contain "RTU Failure" in their title
    let rtu_failures = alerts.iter().filter(|a| a.title.contains("RTU Failure")).count();

    DashboardMetrics {
        total_signals: signals.len(),
        status0_on,
        status1_on,
        duplicates,
        missing_mappings,
        offline_signals,
        signal_distribution: sig_dist,
        protocol_distribution: prot_dist,
        rtu_failures,
        validation_issue_count: issues.len(),
        recent_changes: recent_changes_count,
    }
}
