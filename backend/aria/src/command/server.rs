use std::sync::Arc;

use anyhow::Context;

use aria_core::AriaCore;

use crate::{auth::AriaAuth, server::AriaServer, websocket_server};

pub async fn server(core: AriaCore, serve_files: bool) -> Result<(), anyhow::Error> {
    let jwt_secret = core
        .config
        .jwt_secret
        .as_ref()
        .context("No JWT secret set in configuration")?;

    let auth = Arc::new(AriaAuth::new(jwt_secret.as_bytes()));
    let core = Arc::new(core);

    let server = AriaServer::new(auth.clone(), core.clone(), serve_files);

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
