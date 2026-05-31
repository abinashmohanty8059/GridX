use crate::models::{ProcessedData, ComparisonResult};
use chrono::Utc;

pub fn generate_report(report_type: &str, data_json: &str) -> Result<String, String> {
    let report_type = report_type.to_lowercase();
    match report_type.as_str() {
        "validation" => {
            let data: ProcessedData = serde_json::from_str(data_json)
                .map_err(|e| format!("Failed to deserialize ProcessedData: {}", e))?;
            let mut r = String::new();
            r.push_str("# Substation SCADA Validation Report\n\n");
            r.push_str(&format!("* **Generated**: {}\n", Utc::now().to_rfc3339()));
            r.push_str(&format!("* **Total Signals Checked**: {}\n", data.signals.len()));
            r.push_str(&format!("* **Total Issues Detected**: {}\n\n", data.issues.len()));
            r.push_str("## Active Configuration Anomalies\n");
            if data.issues.is_empty() {
                r.push_str("All parsed substation telemetry signals conform to validation guidelines.\n");
            } else {
                for (i, issue) in data.issues.iter().enumerate() {
                    r.push_str(&format!("{}. **[{}]** Feeder `{}` — {} (Field: `{}`, Value: `{}`)\n", 
                        i + 1, issue.severity.to_uppercase(), issue.feeder_name, issue.description, issue.field, issue.value));
                    r.push_str(&format!("   * *Recommendation*: {}\n", issue.suggestion));
                }
            }
            Ok(r)
        },
        "comparison" => {
            let comp: ComparisonResult = serde_json::from_str(data_json)
                .map_err(|e| format!("Failed to deserialize ComparisonResult: {}", e))?;
            let mut r = String::new();
            r.push_str("# Telemetry Comparison Audit Report\n\n");
            r.push_str(&format!("* **Previous Sheet**: {}\n", comp.previous_file));
            r.push_str(&format!("* **Current Sheet**: {}\n\n", comp.current_file));
            r.push_str("## Comparison Metrics\n");
            r.push_str(&format!("* **Compared Signals**: {}\n", comp.summary.total_compared_signals));
            r.push_str(&format!("* **Added Signals**: {}\n", comp.summary.added_signals));
            r.push_str(&format!("* **Removed Signals**: {}\n", comp.summary.removed_signals));
            r.push_str(&format!("* **Status Transitions**: {}\n", comp.summary.status_changes));
            r.push_str(&format!("* **IEC104 Address Changes**: {}\n", comp.summary.iec_changes));
            r.push_str(&format!("* **Node Path Mappings Changed**: {}\n\n", comp.summary.node_changes));
            
            r.push_str("## Timeline of Signal Audits\n");
            if comp.changes.is_empty() {
                r.push_str("No changes detected between the Excel sheets. Telemetry matches perfectly!\n");
            } else {
                for change in &comp.changes {
                    r.push_str(&format!("* **[{}]** {} — Feeder `{}`: Changed from `{}` to `{}` (Severity: {})\n",
                        change.change_type.to_uppercase(), change.signal_name, change.feeder_name, change.old_value, change.new_value, change.severity));
                }
            }
            Ok(r)
        },
        _ => Err(format!("Unsupported report type: {}", report_type))
    }
}
