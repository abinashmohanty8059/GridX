pub mod models;
pub mod parser;

use models::ProcessedData;

#[tauri::command]
fn process_excel_file(path: String) -> Result<ProcessedData, String> {
    parser::mock_process_excel(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![process_excel_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
