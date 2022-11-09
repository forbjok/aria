use std::{
    borrow::Cow,
    path::{Path, PathBuf},
};

use anyhow::Context;
use aria_models::local::HashedFile;
use aria_shared::util;
use bytes::Bytes;
use futures_core::Stream;

use super::AriaCore;
use crate::util::{hash_blake3_file, hash_blake3_to_file_from_stream};

pub struct ProcessImageResult<'a> {
    pub hash: Cow<'a, str>,
    pub ext: Cow<'a, str>,
    pub original_ext: Cow<'a, str>,
    pub original_image_path: PathBuf,
}

impl AriaCore {
    pub async fn hash_file(&self, path: &Path) -> Result<HashedFile, anyhow::Error> {
        let result = hash_blake3_file(path).await?;

        Ok(HashedFile {
            hash: result.hash,
            path: path.to_path_buf(),
        })
    }

    pub async fn hash_stream_to_temp_file<S: Stream<Item = Result<Bytes, E>> + Unpin, E>(
        &self,
        stream: &mut S,
    ) -> Result<HashedFile, anyhow::Error> {
        let temp_path = self.temp_path.join(uuid::Uuid::new_v4().to_string());
        let result = hash_blake3_to_file_from_stream(stream, &temp_path).await?;

        Ok(HashedFile {
            hash: result.hash,
            path: temp_path,
        })
    }

    /// Process image and move it into the originals directory,
    /// or delete it if it already exists there.
    pub async fn process_image<'a>(
        &self,
        file: HashedFile,
        filename: &'a str,
        destination_path: &Path,
    ) -> Result<ProcessImageResult<'a>, anyhow::Error> {
        let (_, original_ext) = filename
            .rsplit_once('.')
            .context("Could not get extension from filename")?;

        let hash = file.hash;

        let original_image_filename = format!("{hash}.{original_ext}");
        let original_image_path = destination_path.join(original_image_filename);

        // If image does not already exist in originals path, move it there.
        if !original_image_path.exists() {
            util::move_file(file.path, &original_image_path).await?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;

                tokio::fs::set_permissions(&original_image_path, std::fs::Permissions::from_mode(0o644)).await?;
            }
        } else {
            // ... otherwise, delete it.
            tokio::fs::remove_file(file.path).await?;
        }

        let ext = self.image_extension(original_ext);

        Ok(ProcessImageResult {
            hash: hash.into(),
            ext: ext.into(),
            original_ext: original_ext.into(),
            original_image_path,
        })
    }

    pub fn image_extension<'a>(&self, original_ext: &'a str) -> &'a str {
        if self.is_preserve_original(original_ext) {
            original_ext
        } else {
            "webp"
        }
    }

    pub fn is_preserve_original(&self, ext: &str) -> bool {
        ext == "gif"
    }
}
