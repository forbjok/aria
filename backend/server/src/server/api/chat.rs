use std::net::SocketAddr;

use rocket::{
    delete,
    form::{Form, FromForm},
    fs::TempFile,
    http::Status,
    post,
    serde::json::Json,
    Either, State,
};

use aria_models::local as lm;

use crate::server::{
    api::{ApiError, Authorized},
    AriaServer,
};

#[derive(Debug, FromForm)]
pub(super) struct PostRequestModel<'r> {
    pub name: Option<&'r str>,
    pub comment: Option<&'r str>,
    pub image: Option<TempFile<'r>>,
}

#[derive(Debug, FromForm)]
pub(super) struct EmoteRequestModel<'r> {
    pub name: &'r str,
    pub image: Option<TempFile<'r>>,
}

#[post("/chat/<room>/post", data = "<req>")]
pub(super) async fn post(
    server: &State<AriaServer>,
    socket_addr: SocketAddr,
    room: &str,
    mut req: Form<PostRequestModel<'_>>,
) -> Result<Json<u64>, ApiError> {
    let new_post = lm::NewPost {
        name: req
            .name
            .and_then(|v| if v.is_empty() { None } else { Some(v) })
            .map(|v| v.into()),
        comment: req.comment.map(|v| v.into()),
        image: req.image.take().and_then(|f| {
            if let TempFile::File {
                file_name,
                content_type,
                path,
                ..
            } = f
            {
                let filename = file_name.unwrap().dangerous_unsafe_unsanitized_raw().as_str();
                let path = match path {
                    Either::Left(p) => p.keep().unwrap(),
                    Either::Right(p) => p,
                };

                Some(lm::NewPostImage {
                    filename: filename.into(),
                    content_type: content_type.map(|v| v.to_string().into()),
                    path: path.into(),
                })
            } else {
                None
            }
        }),
        ip: socket_addr.ip(),
    };

    let post = server.core.create_post(room, new_post).await?;

    Ok(Json(post.id))
}

#[post("/chat/<room>/emote", data = "<req>")]
pub(super) async fn create_emote(
    auth: Authorized,
    server: &State<AriaServer>,
    room: &str,
    mut req: Form<EmoteRequestModel<'_>>,
) -> Result<Status, ApiError> {
    if auth.claims.name != room {
        return Err(ApiError::Unauthorized);
    }

    let image = req.image.take().and_then(|f| {
        if let TempFile::File {
            file_name,
            content_type,
            path,
            ..
        } = f
        {
            let filename = file_name.unwrap().dangerous_unsafe_unsanitized_raw().as_str();
            let path = match path {
                Either::Left(p) => p.keep().unwrap(),
                Either::Right(p) => p,
            };

            Some(lm::NewPostImage {
                filename: filename.into(),
                content_type: content_type.map(|v| v.to_string().into()),
                path: path.into(),
            })
        } else {
            None
        }
    });

    if image.is_none() {
        return Ok(Status::BadRequest);
    }

    let image = image.unwrap();

    let new_emote = lm::NewEmote {
        name: req.name.into(),
        image,
    };

    server.core.create_emote(room, new_emote).await?;

    Ok(Status::Created)
}

#[delete("/chat/<room>/emote/<name>")]
pub(super) async fn delete_emote(
    auth: Authorized,
    server: &State<AriaServer>,
    room: &str,
    name: &str,
) -> Result<(), ApiError> {
    if auth.claims.name != room {
        return Err(ApiError::Unauthorized);
    }

    server.core.delete_emote(room, name).await?;

    Ok(())
}
