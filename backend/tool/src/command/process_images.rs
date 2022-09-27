use anyhow::Context;

use aria_core::{AriaCore, GeneratePostImageResult, ProcessImageResult};
use tokio::fs;
use tracing::{error, info};

pub async fn process_images() -> Result<(), anyhow::Error> {
    let core = AriaCore::new()?;

    process_post_images(&core).await?;
    process_emote_images(&core).await?;

    Ok(())
}

async fn process_post_images(core: &AriaCore) -> Result<(), anyhow::Error> {
    info!("Process image path: {}", core.process_image_path.display());

    let mut process_images = fs::read_dir(&core.process_image_path).await?;
    while let Some(entry) = process_images.next_entry().await? {
        let result: Result<(), anyhow::Error> = (|| async {
            let filename = entry.file_name();
            let path = entry.path();

            info!("Processing '{}'...", filename.to_string_lossy());

            let filename = filename.to_str().context("Error converting filename to string")?;

            let file = core.hash_file(&path).await?;

            // Process image
            let ProcessImageResult {
                hash,
                ext,
                original_image_path,
                ..
            } = core.process_image(file, filename, &core.original_image_path).await?;

            // Generate image and thumbnail
            let GeneratePostImageResult { tn_ext } = core
                .generate_post_image(&original_image_path, &hash, &ext, true)
                .await?;

            core.update_post_images(&hash, &ext, &tn_ext).await?;

            Ok(())
        })()
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
        let result: Result<(), anyhow::Error> = (|| async {
            let filename = entry.file_name();
            let path = entry.path();

            info!("Processing '{}'...", filename.to_string_lossy());

            let filename = filename.to_str().context("Error converting filename to string")?;

            let file = core.hash_file(&path).await?;

            // Process image
            let ProcessImageResult {
                hash,
                ext,
                original_image_path,
                ..
            } = core.process_image(file, filename, &core.original_emote_path).await?;

            core.generate_emote_image(&original_image_path, &hash, &ext, true)
                .await?;

            core.update_emote_images(&hash, &ext).await?;

            Ok(())
        })()
        .await;

        if let Err(err) = result {
            error!("{err:?}");
        }
    }

    Ok(())
}
