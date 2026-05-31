pub mod models;
pub mod parser;
pub mod state_engine;
pub mod validation_engine;
pub mod alert_engine;
pub mod comparison_engine;
pub mod metrics_engine;
pub mod history_engine;
pub mod report_engine;

use models::{ProcessedData, ComparisonResult};

#[tauri::command]
fn process_excel_file(path: String) -> Result<ProcessedData, String> {
    // 1. Parse the excel file
    let mut signals = parser::parse_excel(&path)?;

    // 2. Determine telemetry states using state_engine
    for s in &mut signals {
        s.state = state_engine::determine_state(&s.status0, &s.status1, &s.remarks, &s.description);
    }

    // 3. Perform telemetry definition checks using validation_engine
    let issues = validation_engine::validate_signals(&signals);

    // 4. Raise event alerts independently using alert_engine
    let alerts = alert_engine::generate_alerts(&signals, &issues);

    // 5. Gather dashboard metrics using metrics_engine
    let metrics = metrics_engine::generate_metrics(&signals, &issues, &alerts, 0);

    Ok(ProcessedData {
        signals,
        issues,
        metrics,
        alerts,
    })
}

#[tauri::command]
fn compare_excel_files(prev_path: String, curr_path: String) -> Result<ComparisonResult, String> {
    // 1. Parse both sheets
    let mut prev_signals = parser::parse_excel(&prev_path)?;
    let mut curr_signals = parser::parse_excel(&curr_path)?;

    // 2. Compute states
    for s in &mut prev_signals {
        s.state = state_engine::determine_state(&s.status0, &s.status1, &s.remarks, &s.description);
    }
    for s in &mut curr_signals {
        s.state = state_engine::determine_state(&s.status0, &s.status1, &s.remarks, &s.description);
    }

    // 3. Perform comparison and retrieve changes & warning alerts
    let (comp_result, _comp_alerts) = comparison_engine::compare_excel_files(
        &prev_path,
        &curr_path,
        &prev_signals,
        &curr_signals,
    );

    Ok(comp_result)
}

#[tauri::command]
fn generate_report_text(report_type: String, data_json: String) -> Result<String, String> {
    report_engine::generate_report(&report_type, &data_json)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            process_excel_file,
            compare_excel_files,
            generate_report_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
