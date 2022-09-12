use std::sync::Arc;

use aria_core::AriaCore;
use clap::Parser;
use tracing::{debug, info};
use tracing_subscriber::{EnvFilter, FmtSubscriber};

use crate::{auth::AriaAuth, server::AriaServer};

mod auth;
mod server;
mod websocket_server;

#[derive(Debug, Parser)]
#[clap(name = "Aria Server", version = env!("CARGO_PKG_VERSION"), author = env!("CARGO_PKG_AUTHORS"))]
struct Opt {
    #[clap(long = "generate-config", help = "Generate default configuration")]
    generate_config: bool,
}

#[rocket::main]
async fn main() -> Result<(), anyhow::Error> {
    let _opt = Opt::parse();

    // Initialize logging
    initialize_logging();

    debug!("Debug logging enabled.");

    let (notify_tx, notify_rx) = futures_channel::mpsc::unbounded();

    let auth = Arc::new(AriaAuth::new(b"sekrit"));
    let core = Arc::new(AriaCore::new(notify_tx)?);

    let server = AriaServer::new(auth, core.clone());

    let shutdown = || async {
        tokio::signal::ctrl_c().await.expect("Error awaiting Ctrl-C signal");
        info!("User initiated shutdown.");
    };

    let http_server = server.run_server();
    let ws_server = websocket_server::run_server(core.clone(), notify_rx, shutdown());

    let (http_result, ws_result) = tokio::join!(http_server, ws_server);

    http_result?;
    ws_result?;

    Ok(())
}

fn initialize_logging() {
    let subscriber = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("Setting default tracing subscriber failed!");
}
