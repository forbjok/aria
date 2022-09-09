use std::{borrow::Cow, net::IpAddr, path::Path};

use chrono::{DateTime, Utc};
use serde_derive::{Deserialize, Serialize};

use crate::api as am;

pub type ContentMetadata = am::ContentMetadata;
pub type Content = am::Content;
pub type Room = am::Room;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ClaimedRoom {
    pub name: String,
    pub password: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PostImage {
    pub filename: String,
    pub hash: String,
    pub ext: String,
    pub tn_ext: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Post {
    pub id: u64,
    pub name: Option<String>,
    pub comment: Option<String>,
    pub image: Option<PostImage>,
    pub posted_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Emote {
    pub name: String,
    pub hash: String,
    pub ext: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct NewPostImage<'a> {
    pub filename: Cow<'a, str>,
    pub content_type: Option<Cow<'a, str>>,
    pub path: Cow<'a, Path>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct NewPost<'a> {
    pub name: Option<Cow<'a, str>>,
    pub comment: Option<Cow<'a, str>>,
    pub image: Option<NewPostImage<'a>>,
    pub ip: IpAddr,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct NewEmote<'a> {
    pub name: Cow<'a, str>,
    pub image: NewPostImage<'a>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct NewRoom<'a> {
    pub name: Cow<'a, str>,
    pub password: Cow<'a, str>,
}
