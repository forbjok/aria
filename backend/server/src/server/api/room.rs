use std::sync::Arc;

use aria_models::api as am;
use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::auth::RoomClaims;
use crate::server::api::{ApiError, Authorized};
use crate::server::AriaServer;

#[derive(Debug, Deserialize)]
struct LoginRequest {
    pub password: String,
}

#[derive(Debug, Serialize)]
struct LoginResponse {
    pub token: String,
}

#[derive(Debug, Deserialize)]
struct ClaimRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
struct ClaimResponse {
    pub id: i32,
    pub name: String,
    pub password: String,
    pub token: String,
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

pub fn router(server: Arc<AriaServer>) -> Router<Arc<AriaServer>> {
    Router::with_state(server)
        .route("/room/:name", get(get_room))
        .route("/claim", post(claim))
        .route("/i/:room_id/login", post(login))
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

    let claims = RoomClaims::new(room.id);
    let token = server.auth.generate_token(&claims)?;

    Ok(Json(ClaimResponse {
        id: room.id,
        name: room.name,
        password: room.password,
        token,
    }))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn login(
    State(server): State<Arc<AriaServer>>,
    Path(room_id): Path<i32>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    if !server.core.login(room_id, &req.password).await? {
        return Err(ApiError::Unauthorized);
    }

    let claims = RoomClaims::new(room_id);
    let token = server.auth.generate_token(&claims)?;

    Ok(Json(LoginResponse { token }))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn logged_in(auth: Authorized, Path(room_id): Path<i32>) -> Result<(), ApiError> {
    if auth.claims.room_id != room_id {
        return Err(ApiError::Unauthorized);
    }

    Ok(())
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn control(
    auth: Authorized,
    State(server): State<Arc<AriaServer>>,
    Path(room_id): Path<i32>,
    Json(req): Json<RoomControlRequest>,
) -> Result<(), ApiError> {
    if auth.claims.room_id != room_id {
        return Err(ApiError::Unauthorized);
    }

    if req.action.action == "set content url" {
        server.core.set_room_content(room_id, &req.action.url).await?;
    }

    Ok(())
}
