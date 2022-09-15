mod chat;
mod room;

use std::sync::Arc;

use axum::{
    async_trait,
    extract::{FromRequestParts, TypedHeader},
    headers::{authorization::Bearer, Authorization},
    http::{request::Parts, StatusCode},
    response::IntoResponse,
    Router,
};
use tracing::error;

use crate::auth::Claims;

use super::AriaServer;

#[derive(Debug)]
enum ApiError {
    Anyhow(anyhow::Error),
    BadRequest,
    NotFound,
    Unauthorized,
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        Self::Anyhow(err)
    }
}

struct Authorized {
    claims: Claims,
}

pub fn router(server: Arc<AriaServer>) -> Router {
    let room = room::router(server.clone());
    let chat = chat::router(server);

    Router::new().nest("/r", room).nest("/chat", chat)
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        match self {
            Self::Anyhow(err) => {
                error!("{err:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, ()).into_response()
            }
            Self::BadRequest => (StatusCode::BAD_REQUEST, ()).into_response(),
            Self::NotFound => (StatusCode::NOT_FOUND, ()).into_response(),
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, ()).into_response(),
        }
    }
}

#[async_trait]
impl FromRequestParts<Arc<AriaServer>> for Authorized {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &Arc<AriaServer>) -> Result<Self, Self::Rejection> {
        // Extract the token from the authorization header
        let TypedHeader(Authorization(bearer)) = TypedHeader::<Authorization<Bearer>>::from_request_parts(parts, state)
            .await
            .map_err(|_| ApiError::Unauthorized)?;

        // Decode the user data
        let claims: Claims = state.auth.verify(bearer.token()).ok_or(ApiError::Unauthorized)?;

        Ok(Authorized { claims })
    }
}
