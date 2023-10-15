mod anim_thumbnail;
mod static_thumbnail;
mod video_preview;

use std::path::Path;

pub use self::anim_thumbnail::*;
pub use self::static_thumbnail::*;
pub use self::video_preview::*;

pub trait ThumbnailGenerator<'a>: Send {
    /// Add thumbnail spec to be generated
    fn add(&mut self, dst_path: &'a Path, width: u32, height: u32);

    /// Generate thumbnails
    fn generate(&self) -> Result<(), anyhow::Error>;
}
