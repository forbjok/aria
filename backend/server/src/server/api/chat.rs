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
    api::{ApiError, Authorized},
    AriaServer,
};

const MAX_IMAGE_SIZE: u64 = 2 * 1024 * 1024; // 2MB

pub fn router(server: Arc<AriaServer>) -> Router<Arc<AriaServer>> {
    Router::with_state(server)
        .route("/:room/post", post(create_post))
        .route("/:room/emote", post(create_emote))
        .route("/:room/emote/:name", delete(delete_emote))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn create_post(
    State(server): State<Arc<AriaServer>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(room): Path<String>,
    ContentLengthLimit(mut multipart): ContentLengthLimit<Multipart, { MAX_IMAGE_SIZE }>,
) -> Result<Json<u64>, ApiError> {
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
    };

    let post = server.core.create_post(&room, new_post).await?;

    Ok(Json(post.id))
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn create_emote(
    auth: Authorized,
    State(server): State<Arc<AriaServer>>,
    Path(room): Path<String>,
    ContentLengthLimit(mut multipart): ContentLengthLimit<Multipart, { MAX_IMAGE_SIZE }>,
) -> Result<(StatusCode, ()), ApiError> {
    if auth.claims.name != room {
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
        let new_emote = lm::NewEmote {
            name: name.into(),
            image,
        };

        server.core.create_emote(&room, new_emote).await?;
        Ok((StatusCode::CREATED, ()))
    } else {
        Err(ApiError::BadRequest)
    }
}

#[axum::debug_handler(state = Arc<AriaServer>)]
async fn delete_emote(
    auth: Authorized,
    State(server): State<Arc<AriaServer>>,
    Path((room, name)): Path<(String, String)>,
) -> Result<(), ApiError> {
    if auth.claims.name != room {
        return Err(ApiError::Unauthorized);
    }

    server.core.delete_emote(&room, &name).await?;

    Ok(())
}
