use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use anyhow::Context;
use serde_derive::Deserialize;
use tracing::error;

use aria_shared::util;

pub const CONFIG_DIR_NAME: &str = "aria";
pub const CONFIG_FILENAME: &str = "config.toml";

pub const DEFAULT_CONFIG: &str = include_str!("default_config.toml");

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct AriaConfig {
    pub files_path: Option<PathBuf>,
    pub database_uri: Option<String>,

    pub jwt_secret: Option<String>,
}

impl AriaConfig {
    pub fn from_file(path: &Path) -> Result<Self, anyhow::Error> {
        use std::io::Read;

        let mut file = fs::File::open(path).context("Error opening config file")?;

        let mut toml_str = String::new();
        file.read_to_string(&mut toml_str)
            .context("Error parsing config file")?;

        Self::from_str(&toml_str)
    }

    pub fn default_location() -> Option<PathBuf> {
        get_default_config_path()
    }

    fn path_from_location(path: &Path) -> Result<PathBuf, anyhow::Error> {
        Ok(path.join(CONFIG_FILENAME))
    }

    pub fn from_location(path: &Path) -> Result<Self, anyhow::Error> {
        let config_file_path = Self::path_from_location(path)?;

        if config_file_path.exists() {
            let config = AriaConfig::from_file(&config_file_path)?;

            Ok(config)
        } else {
            Ok(AriaConfig::load_default()?)
        }
    }

    pub fn from_default_location() -> Result<Self, anyhow::Error> {
        if let Some(path) = Self::default_location() {
            Self::from_location(&path)
        } else {
            Self::load_default()
        }
    }

    pub fn load_default() -> Result<Self, anyhow::Error> {
        DEFAULT_CONFIG.parse()
    }

    pub fn write_default() -> Result<(), anyhow::Error> {
        if let Some(config_location) = Self::default_location() {
            let config_file_path = Self::path_from_location(&config_location)?;

            if !config_file_path.exists() {
                // Create config directory if necessary.
                util::fs::create_parent_dir(&config_file_path).context("Error creating configuration directory")?;

                // Write config file.
                let mut file = fs::File::create(config_file_path).context("Error creating config file")?;

                file.write_all(DEFAULT_CONFIG.as_bytes())
                    .context("Error writing to configuration file")?;
            }
        }

        Ok(())
    }
}

impl FromStr for AriaConfig {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let config: Self = toml::from_str(s).context("Error parsing config file")?;

        Ok(config)
    }
}

pub fn get_default_config_path() -> Option<PathBuf> {
    let config_path = env::var("ARIA_CONFIG_PATH")
        .ok()
        .map(PathBuf::from)
        .or_else(|| dirs::config_dir().map(|p| p.join(CONFIG_DIR_NAME)));

    if config_path.is_none() {
        error!("Could not get configuration path!");
    }

    config_path
}

pub fn generate_default_config() -> Result<(), anyhow::Error> {
    AriaConfig::write_default()?;

    Ok(())
}
