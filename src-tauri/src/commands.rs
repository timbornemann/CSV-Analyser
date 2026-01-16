use crate::state::AppState;
use polars::prelude::*;
use std::fs::File;
use tauri::State;

// Ensure traits are in scope
use polars::io::SerReader;
use polars::io::SerWriter;

#[tauri::command]
pub async fn load_csv(state: State<'_, AppState>, path: String) -> Result<usize, String> {
    let file = File::open(&path).map_err(|e| e.to_string())?;
    
    // CsvReader::new requires file. infer_schema might be named differently or redundant.
    // We use has_header(true) and default inference.
    let df = CsvReader::new(file)
        .finish()
        .map_err(|e: PolarsError| e.to_string())?;

    let height = df.height();
    
    *state.original_df.lock().map_err(|e| e.to_string())? = Some(df.clone());
    *state.current_df.lock().map_err(|e| e.to_string())? = Some(df);
    
    Ok(height)
}

#[tauri::command]
pub fn get_columns(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let binding = state.current_df.lock().map_err(|e| e.to_string())?;
    let df = binding.as_ref().ok_or("No data loaded")?;
    Ok(df.get_column_names().iter().map(|s| s.to_string()).collect())
}

#[tauri::command]
pub fn get_total_rows(state: State<'_, AppState>) -> Result<usize, String> {
    let binding = state.current_df.lock().map_err(|e| e.to_string())?;
    let df = binding.as_ref().ok_or("No data loaded")?;
    Ok(df.height())
}

#[tauri::command]
pub fn get_rows(state: State<'_, AppState>, offset: usize, limit: usize) -> Result<String, String> {
    let binding = state.current_df.lock().map_err(|e| e.to_string())?;
    let df = binding.as_ref().ok_or("No data loaded")?;
    
    let height = df.height();
    let safe_limit = if offset + limit > height {
        height.saturating_sub(offset)
    } else {
        limit
    };

    if safe_limit == 0 {
        return Ok("[]".to_string());
    }
    
    let sliced_df = df.slice(offset as i64, safe_limit);
    
    let mut buf = Vec::new();
    // JsonWriter usually in prelude or polars::io::json
    // We trust prelude here or use simple path
    polars::io::json::JsonWriter::new(&mut buf)
        .with_json_format(JsonFormat::Json)
        .finish(&mut sliced_df.clone())
        .map_err(|e: PolarsError| e.to_string())?;
        
    String::from_utf8(buf).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn apply_sort(state: State<'_, AppState>, column: String, descending: bool) -> Result<usize, String> {
    let mut current_guard = state.current_df.lock().map_err(|e| e.to_string())?;
    
    if let Some(df) = current_guard.as_mut() {
        let sorted_df = df.sort([&column], SortMultipleOptions::default().with_order_descending(descending))
            .map_err(|e: PolarsError| e.to_string())?;
        *df = sorted_df;
        Ok(df.height())
    } else {
        Err("No data loaded".to_string())
    }
}

#[tauri::command]
pub fn apply_filter(state: State<'_, AppState>, column: Option<String>, query: String) -> Result<usize, String> {
    let original_guard = state.original_df.lock().map_err(|e| e.to_string())?;
    let original_df = original_guard.as_ref().ok_or("No data loaded")?;
    
    let filtered_df = if query.is_empty() {
        original_df.clone()
    } else if let Some(col_name) = column {
        let s = original_df.column(&col_name).map_err(|e| e.to_string())?.cast(&DataType::String).map_err(|e| e.to_string())?;
        let ca = s.str().map_err(|e| e.to_string())?;
        let mask = ca.contains_literal(query.as_str()).map_err(|e: PolarsError| e.to_string())?;
        
        original_df.filter(&mask).map_err(|e: PolarsError| e.to_string())?
    } else {
        let mut final_mask: Option<BooleanChunked> = None;
        let cols = original_df.get_column_names();
        
        for col_name in cols {
            if let Ok(s) = original_df.column(col_name) {
                if let Ok(s_str) = s.cast(&DataType::String) {
                     if let Ok(ca) = s_str.str() {
                         if let Ok(mask) = ca.contains_literal(query.as_str()) {
                              match final_mask {
                                  None => final_mask = Some(mask),
                                  Some(ref mut m) => {
                                      let current = m.clone();
                                      // Bitwise OR returns BooleanChunked directly (infallible)
                                      *m = current | mask;
                                  },
                              }
                         }
                     }
                }
            }
        }
        
        if let Some(mask) = final_mask {
             original_df.filter(&mask).map_err(|e: PolarsError| e.to_string())?
        } else {
             original_df.slice(0, 0)
        }
    };
    
    let height = filtered_df.height();
    *state.current_df.lock().map_err(|e| e.to_string())? = Some(filtered_df);
    
    Ok(height)
}
