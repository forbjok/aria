mod chat;
mod room;

use rocket::{
    http::Status,
    request::{FromRequest, Outcome},
    response::Responder,
    routes, Build, Request, Response, Rocket,
};
use tracing::error;

use crate::auth::Claims;

use super::AriaServer;

pub trait MountApi {
    fn mount_api(self, path: &str) -> Self;
}

impl MountApi for Rocket<Build> {
    fn mount_api(self, path: &str) -> Self {
        self.mount(
            path,
            routes![
                chat::post,
                chat::create_emote,
                room::get_room,
                room::login,
                room::logged_in,
                room::claim,
                room::control,
            ],
        )
    }
}

#[derive(Debug)]
enum ApiError {
    Anyhow(anyhow::Error),
    Unauthorized,
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        Self::Anyhow(err)
    }
}

impl<'r> Responder<'r, 'r> for ApiError {
    fn respond_to(self, _request: &'r rocket::Request<'_>) -> rocket::response::Result<'r> {
        let mut res = Response::build();

        match self {
            Self::Anyhow(err) => {
                error!("{err:#}");
                res.status(Status::InternalServerError);
            }
            Self::Unauthorized => {
                res.status(Status::Unauthorized);
            }
        }

        Ok(res.finalize())
    }
}

struct Authorized {
    claims: Claims,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for Authorized {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        if let Some(auth) = request.headers().get("Authorization").next() {
            if let Some((bearer, token)) = auth.split_once(' ') {
                let server = request.rocket().state::<AriaServer>().unwrap();

                if bearer == "Bearer" {
                    let claims: Option<Claims> = server.auth.verify(token);

                    if let Some(claims) = claims {
                        return Outcome::Success(Authorized { claims });
                    }
                }
            }
        }

        Outcome::Failure((Status::Unauthorized, ()))
    }
}
