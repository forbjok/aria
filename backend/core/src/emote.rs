use std::path::{Path, PathBuf};

use anyhow::Context;
use once_cell::sync::Lazy;
use regex::Regex;

use aria_models::local as lm;
use aria_store::{models as dbm, AriaStore};

use super::AriaCore;
use crate::{
    file::ProcessFileResult,
    transform::dbm_emote_to_lm,
    util::{thumbnail::ThumbnailGenerator, video::VideoPreviewGenerator},
    Notification, IMAGE_EXT, VIDEO_EXT,
};

const MAX_WIDTH: u32 = 350;
const MAX_HEIGHT: u32 = 350;

static RE_VALID_EMOTE_NAME: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[\d\w-]+$").unwrap());

impl AriaCore {
    pub async fn get_emotes(&self, room_id: i32) -> Result<Vec<lm::Emote>, anyhow::Error> {
        let emotes = self.store.get_emotes(room_id).await?;

        Ok(emotes.into_iter().map(dbm_emote_to_lm).collect())
    }

    pub async fn create_emote(&self, room_id: i32, emote: lm::NewEmote<'_>) -> Result<lm::Emote, anyhow::Error> {
        if !RE_VALID_EMOTE_NAME.is_match(&emote.name) {
            return Err(anyhow::anyhow!("Emote name must contain only alphanumeric characters"));
        }

        let i = emote.image;

        // Process image
        let ProcessFileResult {
            hash,
            original_ext,
            original_file_path,
            ..
        } = self
            .process_file(i.file, &i.filename, &self.original_emote_path)
            .await?;

        let new_ext = self
            .generate_emote_image(&original_file_path, &hash, &original_ext, false)
            .await?;

        let new_emote = dbm::NewEmote {
            name: Some(emote.name.into()),
            hash: Some(hash.into()),
            ext: Some(new_ext),
        };

        let emote = self.store.create_emote(room_id, &new_emote).await?;
        let emote = dbm_emote_to_lm(emote);

        self.notify(Notification::NewEmote(room_id, emote.clone()))?;

        Ok(emote)
    }

    pub async fn delete_emote(&self, room_id: i32, emote_id: i32) -> Result<bool, anyhow::Error> {
        let success = self.store.delete_emote(room_id, emote_id).await?;

        if success {
            self.notify(Notification::DeleteEmote(room_id, emote_id))?;
        }

        Ok(success)
    }

    pub async fn update_emote_images(&self, hash: &str, ext: &str) -> Result<(), anyhow::Error> {
        self.store.update_emote_images(hash, ext).await?;

        Ok(())
    }

    /// Generate image and thumbnail
    pub async fn generate_emote_image<'a>(
        &self,
        original_image_path: &Path,
        hash: &str,
        ext: &'a str,
        overwrite: bool,
    ) -> Result<String, anyhow::Error> {
        let preserve_original = self.is_preserve_original(ext);

        let is_video = self.is_video(ext);

        let new_ext = if preserve_original {
            ext
        } else if is_video {
            VIDEO_EXT
        } else {
            IMAGE_EXT
        };

        let emote_path = self.build_emote_path(hash, new_ext);

        // If emote image does not already exist, create it.
        let emote_exists = emote_path.exists();
        if overwrite || !emote_exists {
            if emote_exists {
                tokio::fs::remove_file(&emote_path).await?;
            }

            if preserve_original {
                // If preserving original, simply create a hard link to the original file
                tokio::fs::hard_link(original_image_path, &emote_path).await?;
            } else if self.is_video(ext) {
                let mut vp_gen = VideoPreviewGenerator::new(original_image_path);
                vp_gen.add(&emote_path, MAX_WIDTH, MAX_HEIGHT);
                vp_gen.generate().context("Error generating emote video")?;
            } else {
                let mut tn_gen = ThumbnailGenerator::new(original_image_path);
                tn_gen.add(&emote_path, 350, 350);
                tn_gen.generate().context("Error generating emote image")?;
            }
        }

        Ok(new_ext.to_owned())
    }

    fn build_emote_path(&self, hash: &str, ext: &str) -> PathBuf {
        let emote_filename = format!("{hash}.{ext}");

        self.public_emote_path.join(emote_filename)
    }
}
