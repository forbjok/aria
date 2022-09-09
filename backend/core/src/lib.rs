use std::env;
use std::path::PathBuf;

use aria_models::local as lm;
use aria_store::PgStore;
use futures_channel::mpsc::UnboundedSender;

mod emote;
mod post;
mod room;
mod transform;
mod util;

#[derive(Debug)]
pub enum Notification {
    NewPost(String, lm::Post),
    Content(String, lm::Content),
}

pub struct AriaCore {
    //files_path: PathBuf,
    //original_path: PathBuf,
    original_image_path: PathBuf,
    original_emote_path: PathBuf,
    pub public_path: PathBuf,
    public_image_path: PathBuf,
    public_thumbnail_path: PathBuf,
    public_emote_path: PathBuf,
    store: PgStore,
    notify_tx: UnboundedSender<Notification>,
}

impl AriaCore {
    pub fn new(notify_tx: UnboundedSender<Notification>) -> Self {
        let files_path = env::var("FILES_PATH")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs::cache_dir().map(|p| p.join("aria/files")))
            .expect("No files path configured!");

        let original_path = files_path.join("original");
        let original_image_path = original_path.join("i");
        let original_emote_path = original_path.join("e");
        let public_path = files_path.join("public");
        let public_image_path = public_path.join("i");
        let public_thumbnail_path = public_path.join("t");
        let public_emote_path = public_path.join("e");

        let store = PgStore::new(
            &env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://aria:aria@localhost/aria".to_owned()),
        );

        Self {
            //files_path,
            //original_path,
            original_image_path,
            original_emote_path,
            public_path,
            public_image_path,
            public_thumbnail_path,
            public_emote_path,
            store,
            notify_tx,
        }
    }
}
