use polars::prelude::*;
use serde::Serialize;
use std::sync::Mutex;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupingInfo {
    pub column: String,
    pub aggregation: String,
}

pub struct AppState {
    pub original_df: Mutex<Option<DataFrame>>,
    pub current_df: Mutex<Option<DataFrame>>,
    pub file_path: Mutex<Option<String>>,
    pub grouping: Mutex<Option<GroupingInfo>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            original_df: Mutex::new(None),
            current_df: Mutex::new(None),
            file_path: Mutex::new(None),
            grouping: Mutex::new(None),
        }
    }
}
