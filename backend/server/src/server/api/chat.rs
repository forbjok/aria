use std::{net::SocketAddr, sync::Arc};

use anyhow::Context;
use aria_models::local as lm;
use axum::{
    extract::{ConnectInfo, ContentLengthLimit, Multipart, Path, State},
    http::StatusCode,
    routing::{delete, post},
    Json, Router,
};

use crate::server::{
    api::{ApiError, Authorized, User},
    AriaServer,
};

const MAX_IMAGE_SIZE: u64 = 2 * 1024 * 1024; // 2MB

pub fn router(server: Arc<AriaServer>) -> Router<Arc<AriaServer>> {
    Router::with_state(server)
        .route("/:room_id/post", post(create_post))
        .route("/:room_id/post/:post_id", delete(delete_post))
        .route("/:room_id/emote", post(create_emote))
        .route("/:room_id/emote/:emote_id", delete(delete_emote))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn create_post(
    user: User,
    State(server): State<Arc<AriaServer>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(room_id): Path<i32>,
    ContentLengthLimit(mut multipart): ContentLengthLimit<Multipart, { MAX_IMAGE_SIZE }>,
) -> Result<Json<i64>, ApiError> {
    let mut name: Option<String> = None;
    let mut comment: Option<String> = None;
    let mut image: Option<lm::NewPostImage> = None;

    while let Some(mut field) = multipart
        .next_field()
        .await
        .context("Error getting next multipart field")?
    {
        let field_name = field.name().ok_or_else(|| anyhow::anyhow!("Field has no name."))?;

        match field_name {
            "name" => {
                name = Some(field.text().await.map_err(|err| ApiError::Anyhow(err.into()))?);
            }
            "comment" => {
                comment = Some(field.text().await.map_err(|err| ApiError::Anyhow(err.into()))?);
            }
            "image" => {
                let filename = field
                    .file_name()
                    .ok_or_else(|| anyhow::anyhow!("Image has no filename."))?
                    .to_string();

                let content_type = field
                    .content_type()
                    .ok_or_else(|| anyhow::anyhow!("Image has no content type."))?
                    .to_string();

                let file = server.core.hash_stream_to_temp_file(&mut field).await?;

                image = Some(lm::NewPostImage {
                    filename: filename.into(),
                    content_type: Some(content_type.into()),
                    file,
                });
            }
            _ => {}
        }
    }

    let new_post = lm::NewPost {
        name: name
            .and_then(|v| if v.is_empty() { None } else { Some(v) })
            .map(|v| v.into()),
        comment: comment.map(|v| v.into()),
        image,
        ip: addr.ip(),
        user_id: user.id,
    };

    let post = server.core.create_post(room_id, new_post).await?;

    Ok(Json(post.id))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn delete_post(
    user: User,
    auth: Option<Authorized>,
    State(server): State<Arc<AriaServer>>,
    Path((room_id, post_id)): Path<(i32, i64)>,
) -> Result<(), ApiError> {
    let is_admin = auth.map(|a| a.claims.room_id == room_id).unwrap_or(false);

    let success = server.core.delete_post(room_id, post_id, user.id, is_admin).await?;

    if !success {
        return Err(ApiError::NotFound);
    }

    Ok(())
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn create_emote(
    auth: Authorized,
    State(server): State<Arc<AriaServer>>,
    Path(room_id): Path<i32>,
    ContentLengthLimit(mut multipart): ContentLengthLimit<Multipart, { MAX_IMAGE_SIZE }>,
) -> Result<(StatusCode, ()), ApiError> {
    if auth.claims.room_id != room_id {
        return Err(ApiError::Unauthorized);
    }

    let mut name: Option<String> = None;
    let mut image: Option<lm::NewPostImage> = None;

    while let Some(mut field) = multipart
        .next_field()
        .await
        .context("Error getting next multipart field")?
    {
        let field_name = field.name().ok_or_else(|| anyhow::anyhow!("Field has no name."))?;

        match field_name {
            "name" => {
                name = Some(field.text().await.map_err(|err| ApiError::Anyhow(err.into()))?);
            }
            "image" => {
                let filename = field
                    .file_name()
                    .ok_or_else(|| anyhow::anyhow!("Image has no filename."))?
                    .to_string();

                let content_type = field
                    .content_type()
                    .ok_or_else(|| anyhow::anyhow!("Image has no content type."))?
                    .to_string();

                let file = server.core.hash_stream_to_temp_file(&mut field).await?;

                image = Some(lm::NewPostImage {
                    filename: filename.into(),
                    content_type: Some(content_type.into()),
                    file,
                });
            }
            _ => {}
        }
    }

    if let (Some(name), Some(image)) = (name, image) {
        // Don't allow blank name
        if name.is_empty() {
            return Err(ApiError::BadRequest);
        }

        let new_emote = lm::NewEmote {
            name: name.into(),
            image,
        };

        server.core.create_emote(room_id, new_emote).await?;
        Ok((StatusCode::CREATED, ()))
    } else {
        Err(ApiError::BadRequest)
    }
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn delete_emote(
    auth: Authorized,
    State(server): State<Arc<AriaServer>>,
    Path((room_id, emote_id)): Path<(i32, i32)>,
) -> Result<(), ApiError> {
    if auth.claims.room_id != room_id {
        return Err(ApiError::Unauthorized);
    }

    let success = server.core.delete_emote(room_id, emote_id).await?;

    if !success {
        return Err(ApiError::NotFound);
    }

    Ok(())
}
