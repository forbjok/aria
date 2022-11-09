use std::path::Path;

use anyhow::Context;

#[derive(Debug)]
struct Thumbnail<'a> {
    dst_path: &'a Path,
    width: u32,
    height: u32,
}

#[derive(Debug)]
pub struct ThumbnailGenerator<'a> {
    source: &'a Path,
    thumbnails: Vec<Thumbnail<'a>>,
}

impl<'a> ThumbnailGenerator<'a> {
    pub fn new(source: &'a Path) -> Self {
        Self {
            source,
            thumbnails: Vec::new(),
        }
    }

    /// Add thumbnail spec to be generated
    pub fn add(&mut self, dst_path: &'a Path, width: u32, height: u32) {
        self.thumbnails.push(Thumbnail {
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

        // Open image file
        let img = image::open(self.source)?;

        for tn in self.thumbnails.iter() {
            let tn_img = img.thumbnail(tn.width, tn.height);
            tn_img
                .into_rgba8()
                .save(tn.dst_path)
                .context("Error saving thumbnail")?;
        }

        Ok(())
    }
}
