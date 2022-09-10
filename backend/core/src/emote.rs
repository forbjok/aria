use std::path::Path;

use anyhow::Context;

use aria_models::local as lm;
use aria_store::{models as dbm, AriaStore};

use super::AriaCore;
use crate::{image::ProcessImageResult, transform::dbm_emote_to_lm, Notification};

impl AriaCore {
    pub async fn get_emotes(&self, name: &str) -> Result<Vec<lm::Emote>, anyhow::Error> {
        let emotes = self.store.get_emotes(name).await?;

        Ok(emotes.into_iter().map(dbm_emote_to_lm).collect())
    }

    pub async fn create_emote(&self, room: &str, emote: lm::NewEmote<'_>) -> Result<lm::Emote, anyhow::Error> {
        let i = emote.image;

        // Process image
        let ProcessImageResult {
            hash,
            ext,
            original_image_path,
            ..
        } = self
            .process_image(&i.path, &i.filename, &self.original_emote_path)
            .await?;

        self.generate_emote_image(&original_image_path, &hash, &ext, false)
            .await?;

        let new_emote = dbm::NewEmote {
            name: Some(emote.name.into()),
            hash: Some(hash.into()),
            ext: Some(ext.into()),
        };

        let emote = self.store.create_emote(room, &new_emote).await?;
        let emote = dbm_emote_to_lm(emote);

        self.notify_tx
            .unbounded_send(Notification::NewEmote(room.to_string(), emote.clone()))?;

        Ok(emote)
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
                // Open image file
                let img =
                    image::open(original_image_path).with_context(|| "Error opening original emote image file")?;

                let tn_img = img.thumbnail(350, 350);
                tn_img.save(&emote_path).context("Error saving emote image")?;
            }
        }

        Ok(())
    }
}
