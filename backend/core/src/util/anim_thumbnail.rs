use std::{path::Path, process::Command};

use anyhow::{anyhow, Context};

#[derive(Debug)]
struct ThumbnailSpec<'a> {
    dst_path: &'a Path,
    width: u32,
    height: u32,
}

#[derive(Debug)]
pub struct AnimatedThumbnailGenerator<'a> {
    source: &'a Path,
    thumbnails: Vec<ThumbnailSpec<'a>>,
}

impl<'a> AnimatedThumbnailGenerator<'a> {
    pub fn new(source: &'a Path) -> Self {
        Self {
            source,
            thumbnails: Vec::new(),
        }
    }

    /// Add thumbnail spec to be generated
    pub fn add(&mut self, dst_path: &'a Path, width: u32, height: u32) {
        self.thumbnails.push(ThumbnailSpec {
            dst_path,
            width,
            height,
        });
    }

    /// Generate thumbnails
    pub fn generate(self) -> Result<(), anyhow::Error> {
        if self.thumbnails.is_empty() {
            return Ok(());
        }

        for vp in self.thumbnails.iter() {
            let filter_arg = format!(
                r"scale=min({}\,iw):min({}\,ih):force_original_aspect_ratio=decrease,format=yuva420p",
                vp.width, vp.height
            );

            let status = Command::new("ffmpeg")
                .arg("-i")
                .arg(self.source)
                .args(["-map_metadata", "-1", "-filter:v", &filter_arg, "-loop", "0"])
                .arg(vp.dst_path)
                .status()
                .context("Executing ffmpeg")?;

            if !status.success() {
                return Err(anyhow!("Error generating animated thumbnail"));
            }
        }

        Ok(())
    }
}
