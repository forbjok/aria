use anyhow::Context;

use aria_core::AriaCore;
use tokio::fs;
use tracing::{error, info};

pub async fn regenerate_emote_images() -> Result<(), anyhow::Error> {
    let core = AriaCore::new()?;

    info!("Original image path: {}", core.original_emote_path.display());

    let mut original_images = fs::read_dir(&core.original_emote_path).await?;
    while let Some(entry) = original_images.next_entry().await? {
        let result: Result<(), anyhow::Error> = (|| async {
            let filename = entry.file_name();
            let path = entry.path();

            info!("Processing '{}'...", filename.to_string_lossy());

            let filename = filename
                .to_str()
                .with_context(|| format!("Error converting filename '{filename:?}' to string"))?;

            let (hash, ext) = filename
                .split_once('.')
                .context("Error determining hash from filename")?;

            core.generate_emote_image(&path, hash, ext, true).await?;

            core.update_emote_images(hash, ext).await?;

            Ok(())
        })()
        .await;

        if let Err(err) = result {
            error!("{err:?}");
        }
    }

    Ok(())
}
