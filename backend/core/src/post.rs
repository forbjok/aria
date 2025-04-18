use std::{borrow::Cow, path::Path};

use anyhow::Context;
use aria_models::local as lm;
use aria_store::{AriaStore, models as dbm};

use super::AriaCore;
use crate::{
    ANIM_IMAGE_EXT, FileKind, IMAGE_EXT, Notification,
    file::ProcessFileResult,
    transform::dbm_post_to_lm,
    util::thumbnail::{AnimatedThumbnailGenerator, StaticThumbnailGenerator, ThumbnailGenerator, ThumbnailQuality},
};

pub struct GeneratePostImageResult<'a> {
    pub ext: Cow<'a, str>,
    pub tn_ext: Cow<'a, str>,
}

const MAX_IMAGE_WIDTH: u32 = 350;
const MAX_IMAGE_HEIGHT: u32 = 350;
const THUMBNAIL_WIDTH: u32 = 100;
const THUMBNAIL_HEIGHT: u32 = 100;

impl AriaCore {
    pub async fn get_recent_posts(&self, room_id: i32, count: i32) -> Result<Vec<lm::Post>, anyhow::Error> {
        let posts = self.store.get_recent_posts(room_id, count).await?;

        Ok(posts.into_iter().map(dbm_post_to_lm).collect())
    }

    pub async fn create_post(&self, room_id: i32, post: lm::NewPost<'_>) -> Result<lm::Post, anyhow::Error> {
        let image = if let Some(i) = post.image {
            // Process image
            let ProcessFileResult {
                hash,
                original_ext,
                original_file_path,
                ..
            } = self
                .process_file(i.file, &i.filename, &self.original_image_path)
                .await?;

            // Generate image and thumbnail
            let GeneratePostImageResult { ext, tn_ext } = self
                .generate_post_image(&original_file_path, &hash, &original_ext, false)
                .await?;

            Some(dbm::NewImage {
                filename: Some(i.filename.to_string()),
                hash: Some(hash.into()),
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
            user_id: post.user_id,
            admin: post.admin,
        };

        let p = self.store.create_post(room_id, &post, image.as_ref()).await?;

        let post = dbm_post_to_lm(p);

        self.notify(Notification::NewPost(room_id, post.clone()))?;

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
            self.notify(Notification::DeletePost(room_id, post_id))?;
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
        let file_kind = self.identify_file(ext, original_image_path);

        // Animated WebP can't be transcoded, as ffmpeg doesn't support decoding it
        let preserve_original = file_kind == FileKind::AnimatedImage && ext == "webp";

        let ext = if preserve_original { ext } else { IMAGE_EXT };

        let new_ext = if preserve_original {
            ext
        } else {
            match file_kind {
                FileKind::Image => IMAGE_EXT,
                FileKind::AnimatedImage | FileKind::Video => ANIM_IMAGE_EXT,
            }
        };

        let tn_ext = new_ext;

        let image_filename = format!("{hash}.{new_ext}");
        let image_path = self.public_image_path.join(image_filename);

        let thumbnail_filename = format!("{hash}.{tn_ext}");
        let thumbnail_path = self.public_thumbnail_path.join(thumbnail_filename);

        let mut tn_gen: Box<dyn ThumbnailGenerator> = match file_kind {
            FileKind::Image => Box::new(StaticThumbnailGenerator::new(original_image_path)),
            FileKind::AnimatedImage | FileKind::Video => Box::new(AnimatedThumbnailGenerator::new(
                original_image_path,
                ThumbnailQuality::Post,
            )),
        };

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
                tn_gen.add(&image_path, MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT);
            }
        }

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
                tn_gen.add(&thumbnail_path, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
            }
        }

        tn_gen.generate().context("Error generating post image and thumbnail")?;

        Ok(GeneratePostImageResult {
            ext: new_ext.into(),
            tn_ext: tn_ext.into(),
        })
    }
}
