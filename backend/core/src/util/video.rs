use std::{path::Path, process::Command};

use anyhow::{anyhow, Context};

#[derive(Debug)]
struct Preview<'a> {
    dst_path: &'a Path,
    width: u32,
    height: u32,
}

#[derive(Debug)]
pub struct VideoPreviewGenerator<'a> {
    source: &'a Path,
    previews: Vec<Preview<'a>>,
}

impl<'a> VideoPreviewGenerator<'a> {
    pub fn new(source: &'a Path) -> Self {
        Self {
            source,
            previews: Vec::new(),
        }
    }

    /// Add preview spec to be generated
    pub fn add(&mut self, dst_path: &'a Path, width: u32, height: u32) {
        self.previews.push(Preview {
            dst_path,
            width,
            height,
        });
    }

    /// Generate previews
    pub fn generate(self) -> Result<(), anyhow::Error> {
        if self.previews.is_empty() {
            return Ok(());
        }

        for vp in self.previews.iter() {
            let scale_arg = format!("scale={}:{}:force_original_aspect_ratio=decrease", vp.width, vp.height);

            let status = Command::new("ffmpeg")
                .arg("-i")
                .arg(self.source)
                .args([
                    "-map_metadata",
                    "-1",
                    "-filter:v",
                    &scale_arg,
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
