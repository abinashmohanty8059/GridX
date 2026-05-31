use crate::models::{SignalChange, HistoryEvent};
use chrono::Utc;

pub fn generate_history(changes: &[SignalChange]) -> Vec<HistoryEvent> {
    let mut history = Vec::new();
    for c in changes {
        if c.change_type == "status_change" {
            history.push(HistoryEvent {
                timestamp: Utc::now().to_rfc3339(),
                signal: c.signal_name.clone(),
                feeder: c.feeder_name.clone(),
                old_state: c.old_value.clone(),
                new_state: c.new_value.clone(),
                severity: c.severity.clone(),
                category: "Signal State Change".to_string(),
            });
        } else if c.change_type == "new" {
            history.push(HistoryEvent {
                timestamp: Utc::now().to_rfc3339(),
                signal: c.signal_name.clone(),
                feeder: c.feeder_name.clone(),
                old_state: "NONE".to_string(),
                new_state: c.new_value.clone(),
                severity: "info".to_string(),
                category: "New Signal".to_string(),
            });
        } else if c.change_type == "removed" {
            history.push(HistoryEvent {
                timestamp: Utc::now().to_rfc3339(),
                signal: c.signal_name.clone(),
                feeder: c.feeder_name.clone(),
                old_state: c.old_value.clone(),
                new_state: "REMOVED".to_string(),
                severity: "info".to_string(),
                category: "Signal Removed".to_string(),
            });
        }
    }
    history
}
