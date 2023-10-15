use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::local as lm;

#[derive(Debug, Serialize)]
pub struct Room {
    pub id: i32,
    pub name: String,
    pub content: Option<Content>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Content {
    pub url: String,
    pub duration: Option<f64>,
    pub is_livestream: Option<bool>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Image {
    pub filename: String,
    pub url: String,
    pub tn_url: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct Post {
    pub id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    pub posted: DateTime<Utc>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<Image>,

    #[serde(skip_serializing_if = "is_false")]
    pub admin: bool,

    #[serde(skip_serializing_if = "is_false")]
    pub you: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct PlaybackState {
    pub time: f64,
    pub rate: f64,
    pub is_playing: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct Emote {
    pub id: i32,
    pub name: String,
    pub url: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct SysConfig {
    pub max_emote_size: usize,
    pub max_image_size: usize,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self {
            time: 0.,
            rate: 1.,
            is_playing: false,
        }
    }
}

impl From<&lm::Room> for Room {
    fn from(r: &lm::Room) -> Self {
        Self {
            id: r.id,
            name: r.name.clone(),
            content: r.content.clone(),
        }
    }
}

impl From<&lm::Post> for Post {
    fn from(p: &lm::Post) -> Self {
        Self {
            id: p.id,
            name: p.name.clone(),
            comment: p.comment.as_ref().cloned(),
            image: p.image.as_ref().map(|i| Image {
                filename: i.filename.clone(),
                url: format!("/f/i/{}.{}", i.hash, i.ext),
                tn_url: format!("/f/t/{}.{}", i.hash, i.tn_ext),
            }),
            posted: p.posted_at,
            admin: p.admin,
            you: false,
        }
    }
}

impl From<&lm::Emote> for Emote {
    fn from(e: &lm::Emote) -> Self {
        Self {
            id: e.id,
            name: e.name.clone(),
            url: format!("/f/e/{}.{}", e.hash, e.ext),
        }
    }
}

fn is_false(v: &bool) -> bool {
    !v
}
