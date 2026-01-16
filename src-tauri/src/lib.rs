mod commands;
mod state;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state::AppState::new())
        .invoke_handler(tauri::generate_handler![
            load_csv,
            get_rows,
            get_columns,
            get_total_rows,
            apply_sort,
            apply_filter,
            apply_advanced_filter,
            apply_group_by,
            get_current_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
