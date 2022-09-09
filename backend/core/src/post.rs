use anyhow::Context;
use aria_models::local as lm;
use aria_shared::util;
use aria_store::{models as dbm, AriaStore};

use super::AriaCore;
use crate::{transform::dbm_post_to_lm, util::hash_blake3, Notification};

impl AriaCore {
    pub async fn get_recent_posts(&self, name: &str) -> Result<Vec<lm::Post>, anyhow::Error> {
        let posts = self.store.get_recent_posts(name).await?;

        Ok(posts.into_iter().map(dbm_post_to_lm).collect())
    }

    pub async fn create_post(&self, room: &str, post: lm::NewPost<'_>) -> Result<lm::Post, anyhow::Error> {
        let image = if let Some(i) = post.image {
            let original_ext = {
                if let Some((_, ext)) = i.filename.rsplit_once('.') {
                    Some(ext)
                } else {
                    None
                }
            };

            let original_ext = original_ext
                .or_else(|| i.content_type.as_ref().and_then(|ct| mime2ext::mime2ext(&ct)))
                .context("Could not determine file extension for image file")?;

            let (preserve_original, ext) = if original_ext == "gif" {
                (true, original_ext)
            } else if original_ext == "png" {
                (false, "png")
            } else {
                (false, "jpg")
            };

            let tn_ext = ext;

            let hash = hash_blake3(&i.path).await?;

            let original_image_filename = format!("{hash}.{original_ext}");
            let original_image_path = self.original_image_path.join(original_image_filename);

            // If image does not already exist in originals path, move it there.
            if !original_image_path.exists() {
                util::move_file(i.path, &original_image_path).await?;
            } else {
                // ... otherwise, delete it.
                tokio::fs::remove_file(&i.path).await?;
            }

            // Open image file
            let img = image::open(&original_image_path).with_context(|| "Opening image file")?;

            let image_filename = format!("{hash}.{ext}");
            let image_path = self.public_image_path.join(image_filename);

            // If image does not already exist, create it.
            if !image_path.exists() {
                if preserve_original {
                    // If preserving original, simply create a hard link to the original file
                    tokio::fs::hard_link(&original_image_path, &image_path).await?;
                } else {
                    let tn_img = img.thumbnail(500, 500);
                    tn_img.save(&image_path).context("Saving image")?;
                }
            }

            let thumbnail_filename = format!("{hash}.{tn_ext}");
            let thumbnail_path = self.public_thumbnail_path.join(thumbnail_filename);

            // If thumbnail does not already exist, create it.
            if !thumbnail_path.exists() {
                if preserve_original {
                    // If preserving original, simply create a hard link to the original file
                    tokio::fs::hard_link(&original_image_path, &thumbnail_path).await?;
                } else {
                    let tn_img = img.thumbnail(100, 100);
                    tn_img.save(&thumbnail_path).context("Saving thumbnail")?;
                }
            }

            Some(dbm::NewImage {
                filename: Some(i.filename.to_string()),
                hash: Some(hash),
                ext: Some(ext.into()),
                tn_ext: Some(tn_ext.into()),
            })
        } else {
            None
        };

        let post = dbm::NewPost {
            name: post.name.map(|v| v.into()),
            comment: post.comment.map(|v| v.into()),
            ip: Some(post.ip),
        };

        let p = self.store.create_post(room, &post, image.as_ref()).await?;

        let post = dbm_post_to_lm(p);

        self.notify_tx
            .unbounded_send(Notification::NewPost(room.to_string(), post.clone()))?;

        Ok(post)
    }
}
