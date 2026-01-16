use polars::prelude::*;
use std::sync::Mutex;

pub struct AppState {
    pub original_df: Mutex<Option<DataFrame>>,
    pub current_df: Mutex<Option<DataFrame>>,
    pub file_path: Mutex<Option<String>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            original_df: Mutex::new(None),
            current_df: Mutex::new(None),
            file_path: Mutex::new(None),
        }
    }
}
