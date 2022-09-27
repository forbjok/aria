mod auth;
mod chat;
mod room;
mod user;

use std::sync::Arc;

use axum::{
    async_trait,
    extract::{FromRequestParts, TypedHeader},
    headers::{authorization::Bearer, Authorization},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Router,
};
use thiserror::Error;
use tracing::error;

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

pub fn router(server: Arc<AriaServer>) -> Router {
    let auth = auth::router(server.clone());
    let room = room::router(server.clone());
    let chat = chat::router(server.clone());
    let user = user::router(server);

    Router::new()
        .nest("/auth", auth)
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

#[async_trait]
impl FromRequestParts<Arc<AriaServer>> for Authorized {
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &Arc<AriaServer>) -> Result<Self, Self::Rejection> {
        // Extract the token from the authorization header
        let TypedHeader(Authorization(bearer)) = TypedHeader::<Authorization<Bearer>>::from_request_parts(parts, state)
            .await
            .map_err(|_| AuthError::InvalidToken)?;

        let token = bearer.token();

        let claims = state.auth.verify::<AuthClaims>(token)?;

        Ok(Authorized { claims })
    }
}

#[async_trait]
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
