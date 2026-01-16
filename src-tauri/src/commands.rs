use crate::state::AppState;
use polars::prelude::*;
use std::fs::File;
use tauri::State;
use polars::lazy::dsl::{col, len};

// Ensure traits are in scope
use polars::io::SerReader;
use polars::io::SerWriter;

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStateInfo {
    pub file_path: Option<String>,
    pub row_count: usize,
    pub columns: Vec<String>,
}

#[tauri::command]
pub async fn load_csv(state: State<'_, AppState>, path: String) -> Result<usize, String> {
    let file = File::open(&path).map_err(|e| e.to_string())?;
    
    // CsvReader::new requires file.
    let df = CsvReader::new(file)
        .finish()
        .map_err(|e: PolarsError| e.to_string())?;

    let height = df.height();
    
    *state.original_df.lock().map_err(|e| e.to_string())? = Some(df.clone());
    *state.current_df.lock().map_err(|e| e.to_string())? = Some(df);
    *state.file_path.lock().map_err(|e| e.to_string())? = Some(path);
    
    Ok(height)
}

#[tauri::command]
pub fn get_current_state(state: State<'_, AppState>) -> Result<AppStateInfo, String> {
    let path_guard = state.file_path.lock().map_err(|e| e.to_string())?;
    let path = path_guard.clone();
    
    // Release path lock before potentially locking others (though not strictly necessary here as no circular dep)
    drop(path_guard); 

    let current_guard = state.current_df.lock().map_err(|e| e.to_string())?;
    
    if let Some(df) = current_guard.as_ref() {
        Ok(AppStateInfo {
            file_path: path,
            row_count: df.height(),
            columns: df.get_column_names().iter().map(|s| s.to_string()).collect(),
        })
    } else {
        Ok(AppStateInfo {
            file_path: None,
            row_count: 0,
            columns: Vec::new(),
        })
    }
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

use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FilterOperator {
    Contains,
    NotContains,
    Equals,
    NotEquals,
    StartsWith,
    EndsWith,
    GreaterThan,
    LessThan,
    IsNull,
    IsNotNull,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterCondition {
    pub column: String,
    pub operator: FilterOperator,
    pub value: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(untagged)]
pub enum FilterNode {
    Condition(FilterCondition),
    Group {
        logic: String, // "AND" or "OR"
        conditions: Vec<FilterNode>, // Recursion
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AggregationType {
    Count,
    Sum,
    Mean,
    Min,
    Max,
}

// Recursive function to build mask
fn build_filter_mask(df: &DataFrame, node: &FilterNode) -> Result<BooleanChunked, String> {
    match node {
        FilterNode::Group { logic, conditions } => {
            if conditions.is_empty() {
                 let h = df.height();
                 // "mask" needs to be PlSmallStr. using .into()
                 return Ok(BooleanChunked::full("mask".into(), true, h));
            }

            let mut final_mask: Option<BooleanChunked> = None;
            
            for child in conditions {
                let mask = build_filter_mask(df, child)?;
                
                match final_mask {
                    None => final_mask = Some(mask),
                    Some(ref mut m) => {
                        let current = m.clone();
                         if logic.to_uppercase() == "OR" {
                             *m = current | mask;
                         } else {
                             // Default AND
                             *m = current & mask;
                         }
                    }
                }
            }
            
            final_mask.ok_or_else(|| "Failed to build group mask".to_string())
        },
        FilterNode::Condition(cond) => {
             let s = df.column(&cond.column).map_err(|e| e.to_string())?;
             
             // Handle Null checks first
             match cond.operator {
                 FilterOperator::IsNull => return Ok(s.is_null()),
                 FilterOperator::IsNotNull => return Ok(s.is_not_null()),
                 _ => {}
             }
             
             let val = cond.value.as_deref().unwrap_or("");
             
             // Cast to string for regex/contains ops (Owned Column)
             let s_cast = s.cast(&DataType::String).map_err(|e| e.to_string())?;
             // Reference for string-specific ops
             let ca_ref = s_cast.str().map_err(|e| e.to_string())?;

             match cond.operator {
                 FilterOperator::Contains => {
                      ca_ref.contains_literal(val).map_err(|e: PolarsError| e.to_string())
                 },
                 FilterOperator::NotContains => {
                      let mask = ca_ref.contains_literal(val).map_err(|e: PolarsError| e.to_string())?;
                      Ok(!mask)
                 },
                 FilterOperator::StartsWith => {
                      let reg = format!("^{}", regex::escape(val));
                      ca_ref.contains(&reg, true).map_err(|e: PolarsError| e.to_string())
                 },
                 FilterOperator::EndsWith => {
                      let reg = format!("{}$", regex::escape(val));
                      ca_ref.contains(&reg, true).map_err(|e: PolarsError| e.to_string())
                 },
                 FilterOperator::Equals => {
                      // Use Column broadcast.
                      let val_s: Column = Series::new("".into(), [val]).into();
                      // Compare s_cast (Column) with val_s (Column)
                      s_cast.equal(&val_s).map_err(|e: PolarsError| e.to_string())
                 },
                 FilterOperator::NotEquals => {
                      let val_s: Column = Series::new("".into(), [val]).into();
                      let mask = s_cast.equal(&val_s).map_err(|e: PolarsError| e.to_string())?;
                      Ok(!mask)
                 },
                 FilterOperator::GreaterThan => {
                      // Try numeric first
                      if let Ok(num_val) = val.parse::<f64>() {
                           if let Ok(s_num) = s.cast(&DataType::Float64) {
                               let val_s: Column = Series::new("".into(), [num_val]).into();
                               return s_num.gt(&val_s).map_err(|e: PolarsError| e.to_string());
                           }
                      }
                      // Fallback to string
                      let val_s: Column = Series::new("".into(), [val]).into();
                      s_cast.gt(&val_s).map_err(|e: PolarsError| e.to_string())
                 },
                 FilterOperator::LessThan => {
                       if let Ok(num_val) = val.parse::<f64>() {
                           if let Ok(s_num) = s.cast(&DataType::Float64) {
                               let val_s: Column = Series::new("".into(), [num_val]).into();
                               return s_num.lt(&val_s).map_err(|e: PolarsError| e.to_string());
                           }
                      }
                      let val_s: Column = Series::new("".into(), [val]).into();
                      s_cast.lt(&val_s).map_err(|e: PolarsError| e.to_string())
                 },
                 _ => Err(format!("Operator {:?} not handled", cond.operator)),
             }
        }
    }
}

#[tauri::command]
pub fn apply_advanced_filter(state: State<'_, AppState>, filter_tree: FilterNode) -> Result<usize, String> {
    let original_guard = state.original_df.lock().map_err(|e| e.to_string())?;
    let original_df = original_guard.as_ref().ok_or("No data loaded")?;
    
    let mask = build_filter_mask(original_df, &filter_tree)?;
    let filtered_df = original_df.filter(&mask).map_err(|e| e.to_string())?;
    
    let height = filtered_df.height();
    *state.current_df.lock().map_err(|e| e.to_string())? = Some(filtered_df);
    
    Ok(height)
}

#[tauri::command]
pub fn apply_group_by(state: State<'_, AppState>, column: String, _agg: AggregationType) -> Result<String, String> {
    let original_guard = state.original_df.lock().map_err(|e| e.to_string())?;
    let df = original_guard.as_ref().ok_or("No data loaded")?;
    
    // Check if column exists, handling PlSmallStr comparison
    if !df.get_column_names().iter().any(|c| c.as_str() == column.as_str()) {
        return Err(format!("Column not found: {}", column));
    }

    let lazy = df.clone().lazy();
    
    let grouped = lazy.group_by([col(&column)])
        .agg([len().alias("count")])
        .collect()
        .map_err(|e| e.to_string())?
        .sort(vec!["count"], SortMultipleOptions::default().with_order_descending(true))
        .map_err(|e| e.to_string())?;
        
    let height = grouped.height();
    *state.current_df.lock().map_err(|e| e.to_string())? = Some(grouped);
    
    Ok(format!("Grouped by {}, found {} groups", column, height))
}
