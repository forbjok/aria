use anyhow::Context;

use aria_core::{AriaCore, GeneratePostImageResult, ProcessFileResult};
use tokio::fs;
use tracing::{error, info};

pub async fn process_images(core: AriaCore) -> Result<(), anyhow::Error> {
    process_post_images(&core).await?;
    process_emote_images(&core).await?;

    Ok(())
}

async fn process_post_images(core: &AriaCore) -> Result<(), anyhow::Error> {
    info!("Process image path: {}", core.process_image_path.display());

    let mut process_images = fs::read_dir(&core.process_image_path).await?;
    while let Some(entry) = process_images.next_entry().await? {
        let result: Result<(), anyhow::Error> = async {
            let filename = entry.file_name();
            let path = entry.path();

            info!("Processing '{}'...", filename.to_string_lossy());

            let filename = filename.to_str().context("Error converting filename to string")?;

            let file = core.hash_file(&path).await?;

            // Process image
            let ProcessFileResult {
                hash,
                original_ext,
                original_file_path: original_image_path,
                ..
            } = core.process_file(file, filename, &core.original_image_path).await?;

            // Generate image and thumbnail
            let GeneratePostImageResult { ext, tn_ext } = core
                .generate_post_image(&original_image_path, &hash, &original_ext, true)
                .await?;

            core.update_post_images(&hash, &ext, &tn_ext).await?;

            Ok(())
        }
        .await;

        if let Err(err) = result {
            error!("{err:?}");
        }
    }

    Ok(())
}

async fn process_emote_images(core: &AriaCore) -> Result<(), anyhow::Error> {
    info!("Process emote path: {}", core.process_image_path.display());

    let mut process_images = fs::read_dir(&core.process_emote_path).await?;
    while let Some(entry) = process_images.next_entry().await? {
        let result: Result<(), anyhow::Error> = async {
            let filename = entry.file_name();
            let path = entry.path();

            info!("Processing '{}'...", filename.to_string_lossy());

            let filename = filename.to_str().context("Error converting filename to string")?;

            let file = core.hash_file(&path).await?;

            // Process image
            let ProcessFileResult {
                hash,
                original_ext,
                original_file_path: original_image_path,
                ..
            } = core.process_file(file, filename, &core.original_emote_path).await?;

            let ext = core
                .generate_emote_image(&original_image_path, &hash, &original_ext, true)
                .await?;

            core.update_emote_images(&hash, &ext).await?;

            Ok(())
        }
        .await;

        if let Err(err) = result {
            error!("{err:?}");
        }
    }

    Ok(())
}
