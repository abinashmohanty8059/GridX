use crate::models::Signal;
use calamine::{Reader, open_workbook_auto, DataType};
use chrono::Utc;
use log::info;

pub fn parse_excel(path: &str) -> Result<Vec<Signal>, String> {
    info!("Parsing Excel file from path: {}", path);
    
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

    // Map column names dynamically
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
        let remarks = get_cell_string(row, remarks_idx);
        
        let id = format!("s{}", row_idx + 1);
        
        let signal_obj = Signal {
            id,
            sl_no,
            feeder_name,
            description,
            source,
            iec61850_node,
            protocol,
            signal_type,
            status0,
            status1,
            iec104_address,
            remarks,
            state: "UNKNOWN".to_string(), // Will be set by state_engine
            last_updated: Utc::now().to_rfc3339(),
        };
        
        signals.push(signal_obj);
    }
    
    Ok(signals)
}
