use aria_shared::util::htmlize::htmlize_comment;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::local as lm;

#[derive(Debug, Serialize)]
pub struct Room {
    pub name: String,
    pub content: Option<Content>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
#[serde(tag = "type", content = "meta")]
pub enum ContentMetadata {
    Unknown,
    YouTube {
        id: String,
    },
    #[serde(rename = "google_drive")]
    GoogleDrive {
        id: String,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Content {
    pub url: String,

    #[serde(flatten)]
    pub meta: ContentMetadata,
}

#[derive(Clone, Debug, Serialize)]
pub struct Image {
    pub filename: String,
    pub url: String,
    pub tn_url: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct Post {
    pub id: u64,
    pub name: Option<String>,
    pub comment: Option<String>,
    pub posted: DateTime<Utc>,
    pub image: Option<Image>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct PlaybackState {
    pub time: f64,
    pub rate: f64,
    pub is_playing: bool,
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

impl From<&lm::Post> for Post {
    fn from(p: &lm::Post) -> Self {
        Self {
            id: p.id,
            name: p.name.clone(),
            comment: p
                .comment
                .as_ref()
                .map(|c| htmlize_comment(c).unwrap_or_else(|_| c.to_string())),
            image: p.image.as_ref().map(|i| Image {
                filename: i.filename.clone(),
                url: format!("/f/i/{}.{}", i.hash, i.ext),
                tn_url: format!("/f/t/{}.{}", i.hash, i.tn_ext),
            }),
            posted: p.posted_at,
        }
    }
}
