use anyhow::Context;

use aria_core::{AriaCore, GeneratePostImageResult};
use tokio::fs;
use tracing::{error, info};

pub async fn regenerate_post_images(core: AriaCore) -> Result<(), anyhow::Error> {
    info!("Original image path: {}", core.original_image_path.display());

    let mut original_images = fs::read_dir(&core.original_image_path).await?;
    while let Some(entry) = original_images.next_entry().await? {
        let result: Result<(), anyhow::Error> = async {
            let filename = entry.file_name();
            let path = entry.path();

            info!("Processing '{}'...", filename.to_string_lossy());

            let filename = filename
                .to_str()
                .with_context(|| format!("Error converting filename '{filename:?}' to string"))?;

            let (hash, ext) = filename
                .split_once('.')
                .context("Error determining hash from filename")?;

            let GeneratePostImageResult { ext, tn_ext } = core.generate_post_image(&path, hash, ext, true).await?;

            core.update_post_images(hash, &ext, &tn_ext).await?;

            Ok(())
        }
        .await;

        if let Err(err) = result {
            error!("{err:?}");
        }
    }

    Ok(())
}
