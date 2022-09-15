use std::sync::Arc;

use aria_models::api as am;
use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::server::api::{ApiError, Authorized};
use crate::server::AriaServer;

#[derive(Debug, Deserialize)]
struct LoginRequest {
    pub password: String,
}

#[derive(Debug, Serialize)]
struct LoginResponse {
    pub name: String,
    pub token: String,
}

#[derive(Debug, Serialize)]
struct ClaimResponse {
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
        .route("/:name", get(get_room))
        .route("/:name/login", post(login))
        .route("/:name/loggedin", post(logged_in))
        .route("/:name/claim", post(claim))
        .route("/:name/control", post(control))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn get_room(State(server): State<Arc<AriaServer>>, Path(name): Path<String>) -> Result<Json<am::Room>, ApiError> {
    let room = server.core.get_room(&name).await?;
    if let Some(room) = room {
        Ok(Json(room))
    } else {
        Err(ApiError::NotFound)
    }
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn login(
    State(server): State<Arc<AriaServer>>,
    Path(name): Path<String>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    if !server.core.login(&name, &req.password).await? {
        return Err(ApiError::Unauthorized);
    }

    let token = server.auth.generate_room_token(&name)?;

    Ok(Json(LoginResponse { name, token }))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn logged_in(auth: Authorized, Path(name): Path<String>) -> Result<(), ApiError> {
    if auth.claims.name != name {
        return Err(ApiError::Unauthorized);
    }

    Ok(())
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn claim(
    State(server): State<Arc<AriaServer>>,
    Path(name): Path<String>,
) -> Result<Json<ClaimResponse>, ApiError> {
    let room = server.core.claim_room(&name).await?;
    let token = server.auth.generate_room_token(&name)?;

    Ok(Json(ClaimResponse {
        name: room.name,
        password: room.password,
        token,
    }))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn control(
    auth: Authorized,
    State(server): State<Arc<AriaServer>>,
    Path(name): Path<String>,
    Json(req): Json<RoomControlRequest>,
) -> Result<(), ApiError> {
    if auth.claims.name != name {
        return Err(ApiError::Unauthorized);
    }

    if req.action.action == "set content url" {
        server.core.set_room_content(&name, &req.action.url).await?;
    }

    Ok(())
}
