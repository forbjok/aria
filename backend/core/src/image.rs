use std::{
    borrow::Cow,
    path::{Path, PathBuf},
};

use anyhow::Context;
use aria_shared::util;

use super::AriaCore;
use crate::util::hash_blake3;

pub struct ProcessImageResult<'a> {
    pub hash: Cow<'a, str>,
    pub ext: Cow<'a, str>,
    pub original_ext: Cow<'a, str>,
    pub original_image_path: PathBuf,
}

impl AriaCore {
    /// Process image and move it into the originals directory,
    /// or delete it if it already exists there.
    pub async fn process_image<'a>(
        &self,
        path: &Path,
        filename: &'a str,
        destination_path: &Path,
    ) -> Result<ProcessImageResult<'a>, anyhow::Error> {
        let (_, original_ext) = filename
            .rsplit_once('.')
            .context("Could not get extension from filename")?;

        let hash = hash_blake3(path).await?;

        let original_image_filename = format!("{hash}.{original_ext}");
        let original_image_path = destination_path.join(original_image_filename);

        // If image does not already exist in originals path, move it there.
        if !original_image_path.exists() {
            util::move_file(path, &original_image_path).await?;
        } else {
            // ... otherwise, delete it.
            tokio::fs::remove_file(path).await?;
        }

        let ext = if original_ext == "gif" {
            original_ext
        } else if original_ext == "png" {
            "png"
        } else {
            "jpg"
        };

        Ok(ProcessImageResult {
            hash: hash.into(),
            ext: ext.into(),
            original_ext: original_ext.into(),
            original_image_path,
        })
    }

    pub fn is_preserve_original(&self, ext: &str) -> bool {
        ext == "gif"
    }
}
