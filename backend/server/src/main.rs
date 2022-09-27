use std::env;
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
    #[clap(long = "migrate", help = "Run database migration on startup")]
    migrate: bool,
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let opt = Opt::parse();

    // Initialize logging
    initialize_logging();

    debug!("Debug logging enabled.");

    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "sekrit".to_owned());

    let auth = Arc::new(AriaAuth::new(jwt_secret.as_bytes()));
    let core = Arc::new(AriaCore::new()?);

    if opt.migrate {
        info!("Running database migrations...");
        core.migrate().await?;
    }

    let server = AriaServer::new(auth.clone(), core.clone());

    let shutdown = || async {
        tokio::signal::ctrl_c().await.expect("Error awaiting Ctrl-C signal");
    };

    let http_server = server.run_server(shutdown());
    let ws_server = websocket_server::run_server(auth.clone(), core.clone(), shutdown());

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
