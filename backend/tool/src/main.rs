use clap::Parser;

mod command;

use tracing::debug;
use tracing_subscriber::{EnvFilter, FmtSubscriber};

#[derive(Debug, Parser)]
#[clap(name = "Aria Tool", version = env!("CARGO_PKG_VERSION"), author = env!("CARGO_PKG_AUTHORS"))]
struct Opt {
    #[clap(subcommand)]
    command: Command,
}

#[derive(Debug, Parser)]
enum Command {
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

    match opt.command {
        Command::RegeneratePostImages => command::regenerate_post_images().await?,
        Command::RegenerateEmoteImages => command::regenerate_emote_images().await?,
    };

    Ok(())
}

fn initialize_logging() {
    let subscriber = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("warn")))
        .with_writer(std::io::stderr)
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("Setting default tracing subscriber failed!");
}
