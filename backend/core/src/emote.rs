use anyhow::Context;

use aria_models::local as lm;
use aria_shared::util;
use aria_store::{models as dbm, AriaStore};

use super::AriaCore;
use crate::util::hash_blake3;

impl AriaCore {
    pub async fn create_emote(&self, room: &str, emote: lm::NewEmote<'_>) -> Result<u64, anyhow::Error> {
        let i = emote.image;

        let original_ext = {
            if let Some((_, ext)) = i.filename.rsplit_once('.') {
                Some(ext)
            } else {
                None
            }
        };

        let original_ext = original_ext
            .or_else(|| i.content_type.as_ref().and_then(|ct| mime2ext::mime2ext(&ct)))
            .with_context(|| "Could not get a file extension for image file!")?;

        let (preserve_original, ext) = if original_ext == "gif" {
            (true, original_ext)
        } else if original_ext == "png" {
            (false, "png")
        } else {
            (false, "jpg")
        };

        let hash = { hash_blake3(&i.path).await? };

        let original_emote_filename = format!("{hash}.{original_ext}");
        let original_emote_path = self.original_emote_path.join(original_emote_filename);

        // If image does not already exist in originals path, move it there.
        if !original_emote_path.exists() {
            util::move_file(i.path, &original_emote_path).await?;
        } else {
            // ... otherwise, delete it.
            tokio::fs::remove_file(&i.path).await?;
        }

        let emote_filename = format!("{hash}.{ext}");
        let emote_path = self.public_emote_path.join(emote_filename);

        // If image does not already exist, create it.
        if !emote_path.exists() {
            if preserve_original {
                // If preserving original, simply create a hard link to the original file
                tokio::fs::hard_link(&original_emote_path, &emote_path).await?;
            } else {
                // Open image file
                let img = image::open(&original_emote_path).with_context(|| "Opening image file")?;

                let tn_img = img.thumbnail(200, 200);
                tn_img.save(&emote_path).context("Saving emote image")?;
            }
        }

        let new_emote = dbm::NewEmote {
            name: Some(emote.name.into()),
            hash: Some(hash),
            ext: Some(ext.into()),
        };

        let no = self.store.create_emote(room, &new_emote).await?;

        Ok(no as u64)
    }
}
