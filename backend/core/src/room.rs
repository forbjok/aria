use once_cell::sync::Lazy;
use regex::Regex;

use aria_models::local as lm;
use aria_store::AriaStore;

use crate::{transform::dbm_room_to_lm, util::password::generate_simple_password, Notification};

use super::AriaCore;

static RE_YOUTUBE_URL: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"https?://(?:www|m)\.youtube\.com/watch\?v=([^&]+)").unwrap());
static RE_GDRIVE_URL: Lazy<Regex> = Lazy::new(|| Regex::new(r"https?://drive.google.com/file/d/(.+)/view").unwrap());
static RE_TWITCH_URL: Lazy<Regex> = Lazy::new(|| Regex::new(r"https?://(?:www\.)?twitch\.tv/([^#\?]+)").unwrap());

impl AriaCore {
    pub async fn get_room(&self, room_id: i32) -> Result<Option<lm::Room>, anyhow::Error> {
        let room = self.store.get_room(room_id).await?;

        Ok(room.as_ref().map(dbm_room_to_lm))
    }

    pub async fn get_room_by_name(&self, name: &str) -> Result<Option<lm::Room>, anyhow::Error> {
        let room = self.store.get_room_by_name(name).await?;

        Ok(room.as_ref().map(dbm_room_to_lm))
    }

    pub async fn login(&self, room_id: i32, password: &str) -> Result<bool, anyhow::Error> {
        let room = self.store.get_room(room_id).await?;

        Ok(room.map(|r| r.password.unwrap() == password).unwrap_or(false))
    }

    pub async fn claim_room(&self, name: &str) -> Result<lm::ClaimedRoom, anyhow::Error> {
        let password = generate_simple_password(6);

        let room = self.store.create_room(name, &password).await?;

        Ok(lm::ClaimedRoom {
            id: room.id.unwrap(),
            name: room.name.unwrap(),
            password,
        })
    }

    pub async fn set_room_content(&self, room_id: i32, content_url: &str) -> Result<(), anyhow::Error> {
        let meta = if let Some(m) = RE_YOUTUBE_URL.captures(content_url) {
            lm::ContentMetadata::YouTube {
                id: m.get(1).unwrap().as_str().to_owned(),
            }
        } else if let Some(m) = RE_GDRIVE_URL.captures(content_url) {
            lm::ContentMetadata::GoogleDrive {
                id: m.get(1).unwrap().as_str().to_owned(),
            }
        } else if let Some(m) = RE_TWITCH_URL.captures(content_url) {
            lm::ContentMetadata::Twitch {
                channel: m.get(1).unwrap().as_str().to_owned(),
            }
        } else {
            lm::ContentMetadata::Unknown
        };

        let content = lm::Content {
            url: content_url.to_owned(),
            meta,
        };

        let content_json = serde_json::to_string(&content)?;

        self.store.set_room_content(room_id, &content_json).await?;
        self.notify(Notification::Content(room_id, content))?;

        Ok(())
    }
}
