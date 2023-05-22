use std::env;

use clap::Parser;
use tracing::{debug, info};
use tracing_subscriber::{EnvFilter, FmtSubscriber};

use aria_core::{config::AriaConfig, AriaCore};

mod auth;
mod command;
mod server;
mod websocket_server;

#[derive(Debug, Parser)]
#[clap(name = "Aria", version = env!("CARGO_PKG_VERSION"), author = env!("CARGO_PKG_AUTHORS"))]
struct Opt {
    #[clap(long = "migrate", help = "Run database migration on startup")]
    migrate: bool,

    #[clap(subcommand)]
    command: Command,
}

#[derive(Debug, Parser)]
enum Command {
    #[clap(about = "Run Aria server")]
    Server {
        #[clap(long = "serve-files", help = "Serve public files (recommended only for development)")]
        serve_files: bool,
    },

    #[clap(about = "Tool commands")]
    Tool {
        #[clap(subcommand)]
        command: ToolCommand,
    },
}

#[allow(clippy::enum_variant_names)]
#[derive(Debug, Parser)]
enum ToolCommand {
    #[clap(about = "Process images from the 'process' directory")]
    ProcessImages,
    #[clap(about = "Regenerate post images and thumbnails from original files")]
    RegeneratePostImages,
    #[clap(about = "Regenerate emote images from original files")]
    RegenerateEmoteImages,
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let opt = Opt::parse();

    // Initialize logging
    initialize_logging();

    debug!("Debug logging enabled.");

    let config = AriaConfig::from_default_location()?;
    let core = AriaCore::new(config)?;

    if opt.migrate {
        info!("Running database migrations...");
        core.migrate().await?;
    }

    match opt.command {
        Command::Server { serve_files } => command::server(core, serve_files).await?,
        Command::Tool { command } => match command {
            ToolCommand::ProcessImages => command::process_images(core).await?,
            ToolCommand::RegeneratePostImages => command::regenerate_post_images(core).await?,
            ToolCommand::RegenerateEmoteImages => command::regenerate_emote_images(core).await?,
        },
    };

    Ok(())
}

fn initialize_logging() {
    let subscriber = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("Setting default tracing subscriber failed!");
}
