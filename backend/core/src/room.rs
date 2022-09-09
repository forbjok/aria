use aria_models::local as lm;
use aria_store::AriaStore;

use crate::{transform::dbm_room_to_lm, util::password::generate_simple_password, Notification};

use super::AriaCore;

impl AriaCore {
    pub async fn get_room(&self, name: &str) -> Result<Option<lm::Room>, anyhow::Error> {
        let room = self.store.get_room(name).await?;

        Ok(room.as_ref().map(dbm_room_to_lm))
    }

    pub async fn login(&self, room: &str, password: &str) -> Result<bool, anyhow::Error> {
        let room = self.store.get_room(room).await?;

        Ok(room.map(|r| r.password.unwrap() == password).unwrap_or(false))
    }

    pub async fn claim_room(&self, name: &str) -> Result<lm::ClaimedRoom, anyhow::Error> {
        let password = generate_simple_password(6);

        let room = self.store.create_room(name, &password).await?;

        Ok(lm::ClaimedRoom {
            name: room.name.unwrap(),
            password,
        })
    }

    pub async fn set_room_content(&self, room: &str, content_url: &str) -> Result<(), anyhow::Error> {
        let youtube_regex = regex::Regex::new(r#"https?://www.youtube.com/watch\?v=(.+)"#).unwrap();
        let google_drive_regex = regex::Regex::new(r#"https?://drive.google.com/file/d/(.+)/view"#).unwrap();

        let meta = if let Some(m) = youtube_regex.captures(content_url) {
            lm::ContentMetadata::YouTube {
                id: m.get(1).unwrap().as_str().to_owned(),
            }
        } else if let Some(m) = google_drive_regex.captures(content_url) {
            lm::ContentMetadata::GoogleDrive {
                id: m.get(1).unwrap().as_str().to_owned(),
            }
        } else {
            lm::ContentMetadata::Unknown
        };

        let content = lm::Content {
            url: content_url.to_owned(),
            meta,
        };

        let content_json = serde_json::to_string(&content)?;

        self.store.set_room_content(room, &content_json).await?;
        self.notify_tx
            .unbounded_send(Notification::Content(room.to_owned(), content))?;

        Ok(())
    }
}
