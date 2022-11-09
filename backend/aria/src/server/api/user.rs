use std::sync::Arc;

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use serde::Serialize;

use crate::auth::{JwtClaims, UserClaims};
use crate::server::api::{ApiError, User};
use crate::server::AriaServer;

#[derive(Debug, Serialize)]
struct NewUserResponse {
    user_id: i64,
    token: String,
}

pub fn router(server: Arc<AriaServer>) -> Router<Arc<AriaServer>> {
    Router::with_state(server)
        .route("/new", post(new_user))
        .route("/verify", post(verify_user))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn verify_user(_user: User) -> Result<(), ApiError> {
    Ok(())
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn new_user(State(server): State<Arc<AriaServer>>) -> Result<Json<NewUserResponse>, ApiError> {
    let user_id = server.core.generate_user_id().await?;

    let claims = JwtClaims::eternal(UserClaims { user_id });
    let token = server.auth.generate_token(&claims)?;

    Ok(Json(NewUserResponse { user_id, token }))
}
