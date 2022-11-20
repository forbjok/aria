use std::sync::Arc;

use aria_models::api as am;
use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::auth::{AuthClaims, JwtClaims};
use crate::server::api::{ApiError, Authorized};
use crate::server::AriaServer;

use super::auth::LoginResponse;

#[derive(Debug, Deserialize)]
struct ClaimRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
struct ClaimResponse {
    pub id: i32,
    pub name: String,
    pub password: String,
    pub auth: LoginResponse,
}

#[derive(Debug, Deserialize)]
struct RoomControlAction {
    pub action: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
struct RoomControlRequest {
    pub action: RoomControlAction,
}

pub fn router() -> Router<Arc<AriaServer>> {
    Router::new()
        .route("/room/:name", get(get_room))
        .route("/claim", post(claim))
        .route("/i/:room_id/loggedin", post(logged_in))
        .route("/i/:room_id/control", post(control))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn get_room(State(server): State<Arc<AriaServer>>, Path(name): Path<String>) -> Result<Json<am::Room>, ApiError> {
    let room = server.core.get_room_by_name(&name).await?;
    if let Some(room) = room {
        Ok(Json(room))
    } else {
        Err(ApiError::NotFound)
    }
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn claim(
    State(server): State<Arc<AriaServer>>,
    Json(req): Json<ClaimRequest>,
) -> Result<Json<ClaimResponse>, ApiError> {
    let room = server.core.claim_room(&req.name).await?;

    let claims = AuthClaims::Room { room_id: room.id };

    let refresh_token = server.core.create_refresh_token(&claims).await?;

    let claims = JwtClaims::short(claims);
    let exp = claims.exp;
    let access_token = server.auth.generate_token(&claims)?;

    let auth = LoginResponse {
        access_token,
        exp,
        refresh_token,
    };

    Ok(Json(ClaimResponse {
        id: room.id,
        name: room.name,
        password: room.password,
        auth,
    }))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn logged_in(auth: Authorized, Path(room_id): Path<i32>) -> Result<(), ApiError> {
    if auth.for_room(room_id) {
        return Ok(());
    }

    Err(ApiError::Unauthorized)
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn control(
    auth: Authorized,
    State(server): State<Arc<AriaServer>>,
    Path(room_id): Path<i32>,
    Json(req): Json<RoomControlRequest>,
) -> Result<(), ApiError> {
    if !auth.for_room(room_id) {
        return Err(ApiError::Unauthorized);
    }

    if req.action.action == "set content url" {
        server.core.set_room_content(room_id, &req.action.url).await?;
    }

    Ok(())
}
