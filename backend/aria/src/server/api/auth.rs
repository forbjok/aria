use std::sync::Arc;

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{AuthClaims, JwtClaims};
use crate::server::AriaServer;
use crate::server::api::ApiError;

#[derive(Debug, Deserialize)]
#[serde(tag = "level")]
#[serde(rename_all = "lowercase")]
enum LoginRequest {
    Room { room_id: i32, password: String },
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub exp: usize,
    pub refresh_token: Uuid,
}

#[derive(Debug, Deserialize)]
struct RefreshRequest {
    pub refresh_token: Uuid,
}

pub fn router() -> Router<Arc<AriaServer>> {
    Router::new()
        .route("/login", post(login))
        .route("/refresh", post(refresh))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn login(
    State(server): State<Arc<AriaServer>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    let LoginRequest::Room { room_id, password } = req;

    if !server.core.login(room_id, &password).await? {
        return Err(ApiError::Unauthorized);
    }

    let claims = AuthClaims::Room { room_id };

    let refresh_token = server.core.create_refresh_token(&claims).await?;

    let claims = JwtClaims::short(claims);
    let exp = claims.exp;
    let access_token = server.auth.generate_token(&claims)?;

    Ok(Json(LoginResponse {
        access_token,
        exp,
        refresh_token,
    }))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn refresh(
    State(server): State<Arc<AriaServer>>,
    Json(req): Json<RefreshRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    if let Some(result) = server
        .core
        .refresh_refresh_token::<AuthClaims>(req.refresh_token)
        .await?
    {
        let claims = JwtClaims::short(result.claims);
        let access_token = server.auth.generate_token(&claims)?;
        let exp = claims.exp;
        let refresh_token = result.token;

        return Ok(Json(LoginResponse {
            access_token,
            exp,
            refresh_token,
        }));
    }

    Err(ApiError::Unauthorized)
}
