use std::sync::Arc;

use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};

use aria_models::api as am;

use crate::server::AriaServer;
use crate::server::api::ApiError;

pub fn router() -> Router<Arc<AriaServer>> {
    Router::new().route("/config", get(get_config))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn get_config(State(server): State<Arc<AriaServer>>) -> Result<Json<am::SysConfig>, ApiError> {
    Ok(Json(server.core.sys_config.clone()))
}
