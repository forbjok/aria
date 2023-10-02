use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Context;

use aria_models::local as lm;
use aria_models::local::SysConfig;
use aria_store::{AriaStore, PgStore};

mod auth;
pub mod config;
mod emote;
mod file;
mod post;
mod room;
mod transform;
mod user;
mod util;

pub use self::emote::*;
pub use self::file::*;
pub use self::post::*;
pub use self::room::*;

use self::config::AriaConfig;

#[derive(Debug)]
pub enum Notification {
    NewPost(i32, lm::Post),
    NewEmote(i32, lm::Emote),
    DeletePost(i32, i64),
    DeleteEmote(i32, i32),
    Content(i32, lm::Content),
}

pub struct AriaCore {
    pub config: AriaConfig,
    pub sys_config: SysConfig,
    pub temp_path: PathBuf,
    pub process_image_path: PathBuf,
    pub process_emote_path: PathBuf,
    pub original_image_path: PathBuf,
    pub original_emote_path: PathBuf,
    pub public_path: PathBuf,
    pub public_image_path: PathBuf,
    pub public_thumbnail_path: PathBuf,
    pub public_emote_path: PathBuf,
    store: PgStore,
    notify_tx: tokio::sync::broadcast::Sender<Arc<Notification>>,
}

const DEFAULT_MAX_EMOTE_SIZE: usize = 4 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_SIZE: usize = 2 * 1024 * 1024;

impl AriaCore {
    pub fn new(config: AriaConfig) -> Result<Self, anyhow::Error> {
        let sys_config = SysConfig {
            max_emote_size: config.max_emote_size.unwrap_or(DEFAULT_MAX_EMOTE_SIZE),
            max_image_size: config.max_image_size.unwrap_or(DEFAULT_MAX_IMAGE_SIZE),
        };

        let files_path = config
            .files_path
            .clone()
            .or_else(|| dirs::cache_dir().map(|p| p.join("aria/files")))
            .expect("No files path configured!");

        let temp_path = files_path.join("temp");

        let process_path = files_path.join("process");
        let process_image_path = process_path.join("i");
        let process_emote_path = process_path.join("e");

        let original_path = files_path.join("original");
        let original_image_path = original_path.join("i");
        let original_emote_path = original_path.join("e");

        let public_path = files_path.join("public");
        let public_image_path = public_path.join("i");
        let public_thumbnail_path = public_path.join("t");
        let public_emote_path = public_path.join("e");

        // Ensure that all necessary directories exist
        fs::create_dir_all(&temp_path)?;
        fs::create_dir_all(&original_image_path)?;
        fs::create_dir_all(&original_emote_path)?;
        fs::create_dir_all(&public_image_path)?;
        fs::create_dir_all(&public_thumbnail_path)?;
        fs::create_dir_all(&public_emote_path)?;

        let database_uri = config
            .database_uri
            .as_ref()
            .context("Database URI not set in configuration")?;

        let store = PgStore::new(database_uri);

        let (notify_tx, _) = tokio::sync::broadcast::channel(16);

        Ok(Self {
            config,
            sys_config,
            temp_path,
            process_image_path,
            process_emote_path,
            original_image_path,
            original_emote_path,
            public_path,
            public_image_path,
            public_thumbnail_path,
            public_emote_path,
            store,
            notify_tx,
        })
    }

    pub async fn migrate(&self) -> Result<(), anyhow::Error> {
        self.store.migrate().await
    }

    pub fn subscribe_notifications(&self) -> tokio::sync::broadcast::Receiver<Arc<Notification>> {
        self.notify_tx.subscribe()
    }

    fn notify(
        &self,
        notification: Notification,
    ) -> Result<usize, tokio::sync::broadcast::error::SendError<Arc<Notification>>> {
        self.notify_tx.send(Arc::new(notification))
    }
}
