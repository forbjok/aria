use std::{path::Path, process::Command};

use anyhow::{Context, anyhow};

use super::ThumbnailGenerator;

#[derive(Debug)]
struct PreviewSpec<'a> {
    dst_path: &'a Path,
    width: u32,
    height: u32,
}

#[derive(Debug)]
pub struct VideoPreviewGenerator<'a> {
    source: &'a Path,
    previews: Vec<PreviewSpec<'a>>,
}

impl<'a> VideoPreviewGenerator<'a> {
    pub fn new(source: &'a Path) -> Self {
        Self {
            source,
            previews: Vec::new(),
        }
    }
}

impl<'a> ThumbnailGenerator<'a> for VideoPreviewGenerator<'a> {
    fn add(&mut self, dst_path: &'a Path, width: u32, height: u32) {
        self.previews.push(PreviewSpec {
            dst_path,
            width,
            height,
        });
    }

    fn generate(&self) -> Result<(), anyhow::Error> {
        if self.previews.is_empty() {
            return Ok(());
        }

        for vp in self.previews.iter() {
            let filter_arg = format!(
                r"scale=min({}\,iw):min({}\,ih):force_original_aspect_ratio=decrease,format=yuv420p",
                vp.width, vp.height
            );

            let status = Command::new("ffmpeg")
                .args(["-hide_banner", "-y"])
                .arg("-i")
                .arg(self.source)
                .args([
                    "-map_metadata",
                    "-1",
                    "-filter:v",
                    &filter_arg,
                    "-c:v",
                    "libvpx-vp9",
                    "-crf",
                    "42",
                    "-an",
                ])
                .arg(vp.dst_path)
                .status()
                .context("Executing ffmpeg")?;

            if !status.success() {
                return Err(anyhow!("Error generating video preview"));
            }
        }

        Ok(())
    }
}
