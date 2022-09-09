use std::borrow::Cow;

use rocket::serde::json::Json;
use rocket::{get, post, FromForm, State};

use aria_models::api as am;
use serde::{Deserialize, Serialize};

use crate::server::api::{ApiError, Authorized};
use crate::server::AriaServer;

#[derive(Clone, Debug, Deserialize, Serialize, FromForm)]
pub(super) struct LoginRequest<'a> {
    pub password: Cow<'a, str>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(super) struct LoginResponse {
    pub name: String,
    pub token: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(super) struct ClaimResponse {
    pub name: String,
    pub password: String,
    pub token: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, FromForm)]
pub(super) struct RoomControlAction<'a> {
    pub action: Cow<'a, str>,
    pub url: Cow<'a, str>,
}

#[derive(Clone, Debug, Deserialize, Serialize, FromForm)]
pub(super) struct RoomControlRequest<'a> {
    pub action: RoomControlAction<'a>,
}

#[get("/r/<name>")]
pub(super) async fn get_room(server: &State<AriaServer>, name: &str) -> Result<Option<Json<am::Room>>, ApiError> {
    let room = server.core.get_room(name).await?;

    Ok(room.map(Json))
}

#[post("/r/<name>/login", data = "<req>")]
pub(super) async fn login(
    server: &State<AriaServer>,
    name: &str,
    req: Json<LoginRequest<'_>>,
) -> Result<Option<Json<LoginResponse>>, ApiError> {
    if !server.core.login(name, &req.password).await? {
        return Err(ApiError::Unauthorized);
    }

    let token = server.generate_room_token(name)?;

    Ok(Some(Json(LoginResponse {
        name: name.to_owned(),
        token,
    })))
}

#[post("/r/<name>/loggedin")]
pub(super) async fn logged_in(auth: Authorized, name: &str) -> Result<(), ApiError> {
    if auth.claims.name != name {
        return Err(ApiError::Unauthorized);
    }

    Ok(())
}

#[post("/r/<name>/claim")]
pub(super) async fn claim(server: &State<AriaServer>, name: &str) -> Result<Json<ClaimResponse>, ApiError> {
    let room = server.core.claim_room(name).await?;
    let token = server.generate_room_token(name)?;

    Ok(Json(ClaimResponse {
        name: room.name,
        password: room.password,
        token,
    }))
}

#[post("/r/<name>/control", data = "<req>")]
pub(super) async fn control(
    auth: Authorized,
    server: &State<AriaServer>,
    name: &str,
    req: Json<RoomControlRequest<'_>>,
) -> Result<(), ApiError> {
    if auth.claims.name != name {
        return Err(ApiError::Unauthorized);
    }

    if req.action.action == "set content url" {
        server.core.set_room_content(name, &req.action.url).await?;
    }

    Ok(())
}
