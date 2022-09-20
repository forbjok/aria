use std::path::Path;

use anyhow::Context;
use once_cell::sync::Lazy;
use regex::Regex;

use aria_models::local as lm;
use aria_store::{models as dbm, AriaStore};

use super::AriaCore;
use crate::{image::ProcessImageResult, transform::dbm_emote_to_lm, util::thumbnail::ThumbnailGenerator, Notification};

static RE_VALID_EMOTE_NAME: Lazy<Regex> = Lazy::new(|| Regex::new(r#"^[\d\w-]+$"#).unwrap());

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
        let ProcessImageResult {
            hash,
            ext,
            original_image_path,
            ..
        } = self
            .process_image(i.file, &i.filename, &self.original_emote_path)
            .await?;

        self.generate_emote_image(&original_image_path, &hash, &ext, false)
            .await?;

        let new_emote = dbm::NewEmote {
            name: Some(emote.name.into()),
            hash: Some(hash.into()),
            ext: Some(ext.into()),
        };

        let emote = self.store.create_emote(room_id, &new_emote).await?;
        let emote = dbm_emote_to_lm(emote);

        self.notify_tx
            .unbounded_send(Notification::NewEmote(room_id, emote.clone()))?;

        Ok(emote)
    }

    pub async fn delete_emote(&self, room_id: i32, emote_id: i32) -> Result<(), anyhow::Error> {
        self.store.delete_emote(room_id, emote_id).await?;

        self.notify_tx
            .unbounded_send(Notification::DeleteEmote(room_id, emote_id))?;

        Ok(())
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
    ) -> Result<(), anyhow::Error> {
        let preserve_original = self.is_preserve_original(ext);

        let emote_filename = format!("{hash}.{ext}");
        let emote_path = self.public_emote_path.join(emote_filename);

        // If emote image does not already exist, create it.
        let emote_exists = emote_path.exists();
        if overwrite || !emote_exists {
            if emote_exists {
                tokio::fs::remove_file(&emote_path).await?;
            }

            if preserve_original {
                // If preserving original, simply create a hard link to the original file
                tokio::fs::hard_link(original_image_path, &emote_path).await?;
            } else {
                let mut tn_gen = ThumbnailGenerator::new(original_image_path);
                tn_gen.add(&emote_path, 350, 350);
                tn_gen.generate().context("Error generating emote image")?;
            }
        }

        Ok(())
    }
}
