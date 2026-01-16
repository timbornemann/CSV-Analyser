use polars::prelude::*;
use std::sync::Mutex;

pub struct AppState {
    pub original_df: Mutex<Option<DataFrame>>,
    pub current_df: Mutex<Option<DataFrame>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            original_df: Mutex::new(None),
            current_df: Mutex::new(None),
        }
    }
}
