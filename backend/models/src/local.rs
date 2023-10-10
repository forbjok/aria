use std::{borrow::Cow, net::IpAddr, path::PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api as am;

pub type SysConfig = am::SysConfig;
pub type Content = am::Content;
pub type PlaybackState = am::PlaybackState;

#[derive(Debug)]
pub struct HashedFile {
    pub hash: String,
    pub path: PathBuf,
}

#[derive(Debug)]
pub struct ClaimedRoom {
    pub id: i32,
    pub name: String,
    pub password: String,
}

#[derive(Clone, Debug)]
pub struct PostImage {
    pub filename: String,
    pub hash: String,
    pub ext: String,
    pub tn_ext: String,
}

#[derive(Clone, Debug)]
pub struct Post {
    pub id: i64,
    pub name: Option<String>,
    pub comment: Option<String>,
    pub image: Option<PostImage>,
    pub posted_at: DateTime<Utc>,
    pub user_id: i64,
    pub admin: bool,
}

#[derive(Clone, Debug)]
pub struct Emote {
    pub id: i32,
    pub name: String,
    pub hash: String,
    pub ext: String,
}

#[derive(Debug)]
pub struct NewPostImage<'a> {
    pub filename: Cow<'a, str>,
    pub content_type: Option<Cow<'a, str>>,
    pub file: HashedFile,
}

#[derive(Debug)]
pub struct NewPost<'a> {
    pub name: Option<Cow<'a, str>>,
    pub comment: Option<Cow<'a, str>>,
    pub image: Option<NewPostImage<'a>>,
    pub ip: IpAddr,
    pub user_id: i64,
    pub admin: bool,
}

#[derive(Debug)]
pub struct NewEmote<'a> {
    pub name: Cow<'a, str>,
    pub image: NewPostImage<'a>,
}

#[derive(Debug)]
pub struct NewRoom<'a> {
    pub name: Cow<'a, str>,
    pub password: Cow<'a, str>,
}

#[derive(Debug)]
pub struct RefreshRefreshTokenResult<C> {
    pub token: Uuid,
    pub claims: C,
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct PlaybackStateAndTimestamp {
    pub state: PlaybackState,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Default)]
pub struct Room {
    pub id: i32,
    pub name: String,
    pub content: Option<Content>,
    pub playback_state: Option<PlaybackStateAndTimestamp>,
}
