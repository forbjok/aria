use std::{borrow::Cow, path::Path};

use anyhow::Context;
use aria_models::local as lm;
use aria_store::{models as dbm, AriaStore};

use super::AriaCore;
use crate::{image::ProcessImageResult, transform::dbm_post_to_lm, util::thumbnail::ThumbnailGenerator, Notification};

pub struct GeneratePostImageResult<'a> {
    pub tn_ext: Cow<'a, str>,
}

impl AriaCore {
    pub async fn get_recent_posts(&self, room_id: i32, count: i32) -> Result<Vec<lm::Post>, anyhow::Error> {
        let posts = self.store.get_recent_posts(room_id, count).await?;

        Ok(posts.into_iter().map(dbm_post_to_lm).collect())
    }

    pub async fn create_post(&self, room_id: i32, post: lm::NewPost<'_>) -> Result<lm::Post, anyhow::Error> {
        let image = if let Some(i) = post.image {
            // Process image
            let ProcessImageResult {
                hash,
                ext,
                original_image_path,
                ..
            } = self
                .process_image(i.file, &i.filename, &self.original_image_path)
                .await?;

            // Generate image and thumbnail
            let GeneratePostImageResult { tn_ext } = self
                .generate_post_image(&original_image_path, &hash, &ext, false)
                .await?;

            Some(dbm::NewImage {
                filename: Some(i.filename.to_string()),
                hash: Some(hash.into()),
                ext: Some(ext.as_ref().into()),
                tn_ext: Some(tn_ext.into()),
            })
        } else {
            None
        };

        let post = dbm::NewPost {
            name: post.name.map(|v| v.into()),
            comment: post.comment.map(|v| v.into()),
            ip: Some(post.ip),
            user_id: post.user_id,
        };

        let p = self.store.create_post(room_id, &post, image.as_ref()).await?;

        let post = dbm_post_to_lm(p);

        self.notify_tx
            .unbounded_send(Notification::NewPost(room_id, post.clone()))?;

        Ok(post)
    }

    pub async fn delete_post(
        &self,
        room_id: i32,
        post_id: i64,
        user_id: i64,
        is_admin: bool,
    ) -> Result<bool, anyhow::Error> {
        let success = self.store.delete_post(room_id, post_id, user_id, is_admin).await?;

        if success {
            self.notify_tx
                .unbounded_send(Notification::DeletePost(room_id, post_id))?;
        }

        Ok(success)
    }

    pub async fn update_post_images(&self, hash: &str, ext: &str, tn_ext: &str) -> Result<(), anyhow::Error> {
        self.store.update_post_images(hash, ext, tn_ext).await?;

        Ok(())
    }

    /// Generate image and thumbnail
    pub async fn generate_post_image<'a>(
        &self,
        original_image_path: &Path,
        hash: &str,
        ext: &'a str,
        overwrite: bool,
    ) -> Result<GeneratePostImageResult<'a>, anyhow::Error> {
        let preserve_original = self.is_preserve_original(ext);

        let tn_ext = ext;

        let mut tn_gen = ThumbnailGenerator::new(original_image_path);

        let image_filename = format!("{hash}.{ext}");
        let image_path = self.public_image_path.join(image_filename);

        // If image does not already exist, create it.
        let image_exists = image_path.exists();
        if overwrite || !image_exists {
            if preserve_original {
                if image_exists {
                    tokio::fs::remove_file(&image_path).await?;
                }

                // If preserving original, simply create a hard link to the original file
                tokio::fs::hard_link(original_image_path, &image_path).await?;
            } else {
                tn_gen.add(&image_path, 350, 350);
            }
        }

        let thumbnail_filename = format!("{hash}.{tn_ext}");
        let thumbnail_path = self.public_thumbnail_path.join(thumbnail_filename);

        // If thumbnail does not already exist, create it.
        let thumbnail_exists = thumbnail_path.exists();
        if overwrite || !thumbnail_exists {
            if preserve_original {
                if thumbnail_exists {
                    tokio::fs::remove_file(&thumbnail_path).await?;
                }

                // If preserving original, simply create a hard link to the original file
                tokio::fs::hard_link(&original_image_path, &thumbnail_path).await?;
            } else {
                tn_gen.add(&thumbnail_path, 100, 100);
            }
        }

        tn_gen.generate().context("Error generating post image and thumbnail")?;

        Ok(GeneratePostImageResult { tn_ext: tn_ext.into() })
    }
}
