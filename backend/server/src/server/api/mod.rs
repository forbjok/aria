mod chat;
mod room;

use std::sync::Arc;

use axum::{
    async_trait,
    extract::{FromRequestParts, TypedHeader},
    headers::{authorization::Bearer, Authorization},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Router,
};
use tracing::error;

use crate::auth::{AuthError, Claims};

use super::AriaServer;

#[derive(Debug)]
enum ApiError {
    Anyhow(anyhow::Error),
    BadRequest,
    NotFound,
    Unauthorized,
}

impl From<AuthError> for ApiError {
    fn from(_err: AuthError) -> Self {
        Self::Unauthorized
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        Self::Anyhow(err)
    }
}

#[derive(Debug)]
struct Authorized {
    claims: Claims,
}

pub fn router(server: Arc<AriaServer>) -> Router {
    let room = room::router(server.clone());
    let chat = chat::router(server);

    Router::new().nest("/r", room).nest("/chat", chat)
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AuthError::TokenCreation => (StatusCode::INTERNAL_SERVER_ERROR, "Token creation error"),
            AuthError::InvalidToken => (StatusCode::BAD_REQUEST, "Invalid token"),
        };

        (status, error_message).into_response()
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        match self {
            Self::Anyhow(err) => {
                error!("{err:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, format!("{err:#}")).into_response()
            }
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

        let claims = state.auth.verify(token)?;

        Ok(Authorized { claims })
    }
}
