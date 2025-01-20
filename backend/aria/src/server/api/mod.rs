mod auth;
mod chat;
mod room;
mod sys;
mod user;

use std::sync::Arc;

use axum::{
    extract::{FromRequestParts, OptionalFromRequestParts},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    RequestPartsExt, Router,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use thiserror::Error;
use tracing::error;

use aria_models::local as lm;

use crate::auth::{AuthClaims, AuthError, UserClaims};

use super::AriaServer;

#[derive(Debug, Error)]
enum ApiError {
    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
    #[error(transparent)]
    AuthError(#[from] AuthError),
    #[error("Bad request")]
    BadRequest,
    #[error("Not found")]
    NotFound,
    #[error("Unauthorized")]
    Unauthorized,
}

#[derive(Debug)]
struct Authorized {
    claims: AuthClaims,
}

#[derive(Debug)]
struct User {
    id: i64,
}

pub fn router(config: &lm::SysConfig) -> Router<Arc<AriaServer>> {
    let auth = auth::router();
    let sys = sys::router();
    let room = room::router();
    let chat = chat::router(config);
    let user = user::router();

    Router::new()
        .nest("/auth", auth)
        .nest("/sys", sys)
        .nest("/r", room)
        .nest("/chat", chat)
        .nest("/user", user)
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let status = match self {
            AuthError::ExpiredToken => StatusCode::UNAUTHORIZED,
            AuthError::TokenCreation => StatusCode::INTERNAL_SERVER_ERROR,
            AuthError::InvalidToken => StatusCode::BAD_REQUEST,
        };

        (status, self.to_string()).into_response()
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        match self {
            Self::Anyhow(err) => {
                error!("{err:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, format!("{err:#}")).into_response()
            }
            Self::AuthError(AuthError::ExpiredToken) => (StatusCode::UNAUTHORIZED, ()).into_response(),
            Self::AuthError(err) => (StatusCode::BAD_REQUEST, format!("{err:#}")).into_response(),
            Self::BadRequest => (StatusCode::BAD_REQUEST, ()).into_response(),
            Self::NotFound => (StatusCode::NOT_FOUND, ()).into_response(),
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, ()).into_response(),
        }
    }
}

impl FromRequestParts<Arc<AriaServer>> for Authorized {
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &Arc<AriaServer>) -> Result<Self, Self::Rejection> {
        let authorized = Option::<Authorized>::from_request_parts(parts, state).await;

        match authorized {
            Ok(v) => v.ok_or(AuthError::InvalidToken),
            Err(err) => Err(err),
        }
    }
}

impl OptionalFromRequestParts<Arc<AriaServer>> for Authorized {
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &Arc<AriaServer>) -> Result<Option<Self>, Self::Rejection> {
        // Extract the token from the authorization header
        let auth_header = parts
            .extract::<Option<TypedHeader<Authorization<Bearer>>>>()
            .await
            .map_err(|_| AuthError::InvalidToken)?;

        let Some(TypedHeader(Authorization(bearer))) = auth_header else {
            return Ok(None);
        };

        let token = bearer.token();

        let claims = state.auth.verify::<AuthClaims>(token)?;

        Ok(Some(Authorized { claims }))
    }
}

impl FromRequestParts<Arc<AriaServer>> for User {
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, state: &Arc<AriaServer>) -> Result<Self, Self::Rejection> {
        let token = parts
            .headers
            .get("X-User")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_owned())
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let claims = state
            .auth
            .verify::<UserClaims>(&token)
            .map_err(|_| StatusCode::UNAUTHORIZED)?;

        Ok(User { id: claims.user_id })
    }
}

impl Authorized {
    pub fn for_room(&self, room_id: i32) -> bool {
        self.claims.for_room(room_id)
    }
}
