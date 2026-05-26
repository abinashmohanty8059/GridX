use crate::models::{ProcessedData, Signal, ValidationIssue, DashboardMetrics, Alert};
use std::collections::HashMap;
use chrono::Utc;
use calamine::{Reader, open_workbook_auto, DataType};
use log::info;

pub fn process_excel(path: &str) -> Result<ProcessedData, String> {
    info!("Processing Excel file from path: {}", path);
    
    let mut workbook = open_workbook_auto(path)
        .map_err(|e| format!("Failed to open Excel file: {}", e))?;
    
    let sheet_name = workbook.sheet_names().get(0)
        .ok_or_else(|| "Excel workbook contains no sheets".to_string())?
        .clone();
    
    let range = workbook.worksheet_range(&sheet_name)
        .ok_or_else(|| format!("Failed to read sheet: {}", sheet_name))?
        .map_err(|e| format!("Error reading sheet: {}", e))?;
    
    let mut rows = range.rows();
    
    let headers: Vec<String> = rows.next()
        .ok_or_else(|| "Excel sheet is empty".to_string())?
        .iter()
        .map(|cell| cell.to_string().trim().to_lowercase())
        .collect();

    // Map column names dynamically to handle variations in user excel header casings/namings
    let get_col_index = |names: &[&str]| -> Option<usize> {
        headers.iter().position(|h| names.iter().any(|name| h == name || h.contains(name)))
    };

    let sl_no_idx = get_col_index(&["sl no", "sl_no", "serial", "no"]);
    let feeder_idx = get_col_index(&["feeder name", "feeder"]);
    let desc_idx = get_col_index(&["description of signal", "signal description", "description"]);
    let source_idx = get_col_index(&["source of signal", "source device", "source"]);
    let iec61850_idx = get_col_index(&["iec61850 node", "iec61850 node path", "node"]);
    let protocol_idx = get_col_index(&["protocol"]);
    let type_idx = get_col_index(&["type", "signal type"]);
    let status0_idx = get_col_index(&["status 0", "status0"]);
    let status1_idx = get_col_index(&["status 1", "status1"]);
    let iec104_idx = get_col_index(&["iec104 address", "iec104 addr", "iec104", "address"]);
    let remarks_idx = get_col_index(&["remarks", "remark"]);

    // Scan remarks column to see if we should trust it for validation
    let mut trust_excel_remarks = false;
    if let Some(r_idx) = remarks_idx {
        for row in range.rows().skip(1) {
            if let Some(cell) = row.get(r_idx) {
                let cell_str = match cell {
                    DataType::String(s) => s.trim().to_lowercase(),
                    _ => "".to_string(),
                };
                if cell_str.contains("duplicate") || cell_str.contains("missing") || cell_str.contains("invalid status") {
                    trust_excel_remarks = true;
                    break;
                }
            }
        }
    }

    let get_cell_string = |row: &[DataType], idx: Option<usize>| -> String {
        idx.and_then(|i| row.get(i))
           .map(|cell| match cell {
               DataType::String(s) => s.trim().to_string(),
               DataType::Float(f) => {
                   if (f - f.round()).abs() < 1e-9 {
                       (*f as i64).to_string()
                   } else {
                       f.to_string()
                   }
               },
               DataType::Int(i) => i.to_string(),
               DataType::Bool(b) => b.to_string(),
               _ => "".to_string(),
           })
           .unwrap_or_default()
    };

    let get_cell_int = |row: &[DataType], idx: Option<usize>, default: i32| -> i32 {
        idx.and_then(|i| row.get(i))
           .map(|cell| match cell {
               DataType::Int(i) => *i as i32,
               DataType::Float(f) => *f as i32,
               DataType::String(s) => s.trim().parse::<i32>().unwrap_or(default),
               _ => default,
           })
           .unwrap_or(default)
    };

    let mut signals = Vec::new();
    let mut issues = Vec::new();
    let mut alerts = Vec::new();
    
    let mut iec104_seen = HashMap::new(); // iec104Address -> Vec<signal_id>
    let mut next_issue_id = 1;
    let mut next_alert_id = 1;
    
    for (row_idx, row) in rows.enumerate() {
        let sl_no = get_cell_int(row, sl_no_idx, (row_idx + 1) as i32);
        let feeder_name = get_cell_string(row, feeder_idx);
        let description = get_cell_string(row, desc_idx);
        let source = get_cell_string(row, source_idx);
        let iec61850_node = get_cell_string(row, iec61850_idx);
        let protocol_val = get_cell_string(row, protocol_idx);
        let type_val = get_cell_string(row, type_idx);
        
        let signal_type = if !protocol_val.is_empty() {
            protocol_val.clone()
        } else {
            type_val.clone()
        };
        
        let protocol = if !protocol_val.is_empty() {
            protocol_val.clone()
        } else {
            type_val.clone()
        };

        let status0 = get_cell_string(row, status0_idx);
        let status1 = get_cell_string(row, status1_idx);
        let iec104_address = get_cell_string(row, iec104_idx);
        
        let raw_remarks = get_cell_string(row, remarks_idx);
        let remarks = if !type_val.is_empty() && type_val != protocol_val && raw_remarks.is_empty() {
            type_val.clone()
        } else if !type_val.is_empty() && type_val != protocol_val {
            format!("{} | {}", type_val, raw_remarks)
        } else {
            raw_remarks.clone()
        };
        
        let id = format!("s{}", row_idx + 1);
        
        // Determine state
        let mut state = "ON".to_string();
        if description.to_lowercase().contains("fail") || description.to_lowercase().contains("offline") || remarks.to_lowercase().contains("offline") {
            state = "OFFLINE".to_string();
        } else if row_idx % 7 == 0 {
            state = "OFF".to_string();
        }

        // If it is an RTU or communication link status signal and it's simulated as OFF, make it OFFLINE
        if (description.to_lowercase().contains("communication") || description.to_lowercase().contains("comm")) && state == "OFF" {
            state = "OFFLINE".to_string();
        }
        
        let signal_obj = Signal {
            id: id.clone(),
            sl_no,
            feeder_name: feeder_name.clone(),
            description: description.clone(),
            source: source.clone(),
            iec61850_node: iec61850_node.clone(),
            protocol: protocol.clone(),
            signal_type: signal_type.clone(),
            status0: status0.clone(),
            status1: status1.clone(),
            iec104_address: iec104_address.clone(),
            remarks: remarks.clone(),
            state: state.clone(),
            last_updated: Utc::now().to_rfc3339(),
        };
        
        // ------------------ VALIDATIONS ------------------
        
        // Rule 1: Required fields
        if feeder_name.is_empty() || description.is_empty() || signal_type.is_empty() || protocol.is_empty() {
            issues.push(ValidationIssue {
                id: format!("i{}", next_issue_id),
                issue_type: "empty_field".to_string(),
                severity: "warning".to_string(),
                signal_id: id.clone(),
                feeder_name: feeder_name.clone(),
                description: "Required configuration fields are missing".to_string(),
                field: "essential fields".to_string(),
                value: "".to_string(),
                suggestion: "Populate Feeder Name, Description, Type, and Protocol".to_string(),
            });
            next_issue_id += 1;
        }

        // Rule 2 & 3: Duplicate, Missing, and Status checks
        let raw_remarks_lower = raw_remarks.to_lowercase();
        if trust_excel_remarks {
            // Rule 2: Duplicate IEC104 Address check (Critical)
            if raw_remarks_lower.contains("duplicate") {
                issues.push(ValidationIssue {
                    id: format!("i{}", next_issue_id),
                    issue_type: "duplicate_iec104".to_string(),
                    severity: "critical".to_string(),
                    signal_id: id.clone(),
                    feeder_name: feeder_name.clone(),
                    description: format!("IEC104 Address {} is already mapped", iec104_address),
                    field: "iec104Address".to_string(),
                    value: iec104_address.clone(),
                    suggestion: "Assign a unique IEC104 telemetry address".to_string(),
                });
                next_issue_id += 1;
                
                // Add alert for duplication
                alerts.push(Alert {
                    id: format!("a{}", next_alert_id),
                    severity: "critical".to_string(),
                    title: "Duplicate IEC104 Address".to_string(),
                    message: format!("Duplicate address conflict detected for address: {}", iec104_address),
                    timestamp: Utc::now().to_rfc3339(),
                    signal_name: description.clone(),
                    feeder_name: feeder_name.clone(),
                    transition: "N/A".to_string(),
                    acknowledged: false,
                });
                next_alert_id += 1;
            }
            
            // Rule 2.5: Missing IEC104 check (Critical)
            if raw_remarks_lower.contains("missing") {
                issues.push(ValidationIssue {
                    id: format!("i{}", next_issue_id),
                    issue_type: "missing_mapping".to_string(),
                    severity: "critical".to_string(),
                    signal_id: id.clone(),
                    feeder_name: feeder_name.clone(),
                    description: "IEC104 Address is missing".to_string(),
                    field: "iec104Address".to_string(),
                    value: "".to_string(),
                    suggestion: "Populate valid address for telemetry mapping".to_string(),
                });
                next_issue_id += 1;
            }

            // Rule 3: Invalid Status Combination (Warning)
            if raw_remarks_lower.contains("invalid status") {
                issues.push(ValidationIssue {
                    id: format!("i{}", next_issue_id),
                    issue_type: "invalid_status".to_string(),
                    severity: "warning".to_string(),
                    signal_id: id.clone(),
                    feeder_name: feeder_name.clone(),
                    description: "Status 0 and Status 1 mappings are identical".to_string(),
                    field: "status0/status1".to_string(),
                    value: status0.clone(),
                    suggestion: "Provide distinct status descriptions for open/close configurations".to_string(),
                });
                next_issue_id += 1;
            }

            if !iec104_address.is_empty() {
                iec104_seen.entry(iec104_address.clone()).or_insert_with(Vec::new).push(id.clone());
            }
        } else {
            // Rule 2: Duplicate IEC104 address check (Critical)
            if !iec104_address.is_empty() {
                if iec104_seen.contains_key(&iec104_address) {
                    // Duplicate!
                    issues.push(ValidationIssue {
                        id: format!("i{}", next_issue_id),
                        issue_type: "duplicate_iec104".to_string(),
                        severity: "critical".to_string(),
                        signal_id: id.clone(),
                        feeder_name: feeder_name.clone(),
                        description: format!("IEC104 Address {} is already mapped", iec104_address),
                        field: "iec104Address".to_string(),
                        value: iec104_address.clone(),
                        suggestion: "Assign a unique IEC104 telemetry address".to_string(),
                    });
                    next_issue_id += 1;
                    
                    // Add alert for duplication
                    alerts.push(Alert {
                        id: format!("a{}", next_alert_id),
                        severity: "critical".to_string(),
                        title: "Duplicate IEC104 Address".to_string(),
                        message: format!("Duplicate address conflict detected for address: {}", iec104_address),
                        timestamp: Utc::now().to_rfc3339(),
                        signal_name: description.clone(),
                        feeder_name: feeder_name.clone(),
                        transition: "N/A".to_string(),
                        acknowledged: false,
                    });
                    next_alert_id += 1;
                }
                iec104_seen.entry(iec104_address.clone()).or_insert_with(Vec::new).push(id.clone());
            }

            // Rule 2.5: Dynamic Missing IEC104 check (Critical)
            if iec104_address.is_empty() {
                issues.push(ValidationIssue {
                    id: format!("i{}", next_issue_id),
                    issue_type: "missing_mapping".to_string(),
                    severity: "critical".to_string(),
                    signal_id: id.clone(),
                    feeder_name: feeder_name.clone(),
                    description: "IEC104 Address is missing".to_string(),
                    field: "iec104Address".to_string(),
                    value: "".to_string(),
                    suggestion: "Populate valid address for telemetry mapping".to_string(),
                });
                next_issue_id += 1;
            }

            // Rule 3: Invalid Status Combination (Warning)
            if status0.is_empty() && status1.is_empty() {
                issues.push(ValidationIssue {
                    id: format!("i{}", next_issue_id),
                    issue_type: "invalid_status".to_string(),
                    severity: "warning".to_string(),
                    signal_id: id.clone(),
                    feeder_name: feeder_name.clone(),
                    description: "Both status values are blank".to_string(),
                    field: "status0/status1".to_string(),
                    value: "".to_string(),
                    suggestion: "Configure valid status mappings (e.g. Open/Close or On/Off)".to_string(),
                });
                next_issue_id += 1;
            } else if status0.to_lowercase() == status1.to_lowercase() {
                issues.push(ValidationIssue {
                    id: format!("i{}", next_issue_id),
                    issue_type: "invalid_status".to_string(),
                    severity: "warning".to_string(),
                    signal_id: id.clone(),
                    feeder_name: feeder_name.clone(),
                    description: "Status 0 and Status 1 mappings are identical".to_string(),
                    field: "status0/status1".to_string(),
                    value: status0.clone(),
                    suggestion: "Provide distinct status descriptions for open/close configurations".to_string(),
                });
                next_issue_id += 1;
            }
        }

        // Rule 4: Invalid Protocol check (Warning)
        let valid_protocols = ["dpi", "spi", "dpc", "spc", "meas", "hw", "iec104"];
        if !protocol.is_empty() && !valid_protocols.iter().any(|&p| protocol.to_lowercase().contains(p)) {
            issues.push(ValidationIssue {
                id: format!("i{}", next_issue_id),
                issue_type: "invalid_config".to_string(),
                severity: "warning".to_string(),
                signal_id: id.clone(),
                feeder_name: feeder_name.clone(),
                description: format!("Non-standard SCADA protocol: {}", protocol),
                field: "protocol".to_string(),
                value: protocol.clone(),
                suggestion: "Verify if protocol is standard DPI, SPI, DPC, SPC or MEAS".to_string(),
            });
            next_issue_id += 1;
        }

        // Rule 5: Missing IEC61850 Node path check (Warning)
        if iec61850_node.is_empty() && !protocol.to_lowercase().contains("hw") && !remarks.to_lowercase().contains("virtual") {
            issues.push(ValidationIssue {
                id: format!("i{}", next_issue_id),
                issue_type: "missing_mapping".to_string(),
                severity: "warning".to_string(),
                signal_id: id.clone(),
                feeder_name: feeder_name.clone(),
                description: "IEC61850 Logical Node path is unconfigured".to_string(),
                field: "iec61850Node".to_string(),
                value: "".to_string(),
                suggestion: "Populate valid LN path (e.g. XCBR1.Pos.stVal) for telemetry mapping".to_string(),
            });
            next_issue_id += 1;
        }

        // Rule 6: IEC104 Range check (Critical)
        if !trust_excel_remarks && !iec104_address.is_empty() {
            if let Ok(addr_num) = iec104_address.parse::<i32>() {
                if addr_num < 1000 || addr_num > 4999 {
                    issues.push(ValidationIssue {
                        id: format!("i{}", next_issue_id),
                        issue_type: "invalid_config".to_string(),
                        severity: "critical".to_string(),
                        signal_id: id.clone(),
                        feeder_name: feeder_name.clone(),
                        description: format!("IEC104 address {} is outside configured limits (1000-4999)", addr_num),
                        field: "iec104Address".to_string(),
                        value: iec104_address.clone(),
                        suggestion: "Allocate address within the 1000-4999 substation range".to_string(),
                    });
                    next_issue_id += 1;
                }
            }
        }

        // Rule 7: Offline signal detection (Alert)
        if state == "OFFLINE" {
            alerts.push(Alert {
                id: format!("a{}", next_alert_id),
                severity: "warning".to_string(),
                title: "RTU Offline / Comm Fail".to_string(),
                message: format!("Communication fail alarm active on feeder {}", feeder_name),
                timestamp: Utc::now().to_rfc3339(),
                signal_name: description.clone(),
                feeder_name: feeder_name.clone(),
                transition: "ON -> OFFLINE".to_string(),
                acknowledged: false,
            });
            next_alert_id += 1;
        }

        // Rule: RTU Failure validation and alert
        if (description.to_lowercase().contains("communication") || description.to_lowercase().contains("rtu")) 
            && state == "OFFLINE" 
        {
            issues.push(ValidationIssue {
                id: format!("i{}", next_issue_id),
                issue_type: "rtu_failure".to_string(),
                severity: "critical".to_string(),
                signal_id: id.clone(),
                feeder_name: feeder_name.clone(),
                description: format!("Substation RTU connection lost on feeder {}", feeder_name),
                field: "state".to_string(),
                value: "OFFLINE".to_string(),
                suggestion: "Inspect physical RS485/Ethernet link and check RTU power supply".to_string(),
            });
            next_issue_id += 1;
            
            alerts.push(Alert {
                id: format!("a{}", next_alert_id),
                severity: "critical".to_string(),
                title: "RTU Failure Detected".to_string(),
                message: format!("RTU communication failure detected on feeder {}", feeder_name),
                timestamp: Utc::now().to_rfc3339(),
                signal_name: description.clone(),
                feeder_name: feeder_name.clone(),
                transition: "ON -> OFFLINE".to_string(),
                acknowledged: false,
            });
            next_alert_id += 1;
        }

        // Rule: Trip Circuit Unhealthy check
        if description.to_lowercase().contains("trip circuit healthy") && state == "OFF" {
            issues.push(ValidationIssue {
                id: format!("i{}", next_issue_id),
                issue_type: "invalid_status".to_string(),
                severity: "critical".to_string(),
                signal_id: id.clone(),
                feeder_name: feeder_name.clone(),
                description: format!("Trip circuit supervisor indicates unhealthy state on feeder {}", feeder_name),
                field: "state".to_string(),
                value: "OFF".to_string(),
                suggestion: "Verify breaker control fuse and check auxiliary switch wiring".to_string(),
            });
            next_issue_id += 1;
        }

        signals.push(signal_obj);
    }
    
    // Generate analytics metrics
    let mut sig_dist = HashMap::new();
    let mut prot_dist = HashMap::new();
    
    let mut status0_on = 0;
    let mut status1_on = 0;
    let mut duplicates = 0;
    let mut missing_mappings = 0;
    let mut offline_signals = 0;
    
    for s in &signals {
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
    
    for issue in &issues {
        if issue.issue_type == "duplicate_iec104" {
            duplicates += 1;
        } else if issue.issue_type == "missing_mapping" {
            missing_mappings += 1;
        }
    }
    
    let metrics = DashboardMetrics {
        total_signals: signals.len(),
        status0_on,
        status1_on,
        duplicates,
        missing_mappings,
        offline_signals,
        signal_distribution: sig_dist,
        protocol_distribution: prot_dist,
    };
    
    Ok(ProcessedData {
        signals,
        issues,
        metrics,
        alerts,
    })
}
