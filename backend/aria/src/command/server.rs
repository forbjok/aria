use std::sync::Arc;

use aria_core::AriaCore;

use crate::{auth::AriaAuth, server::AriaServer, websocket_server};

pub async fn server(auth: Arc<AriaAuth>, core: Arc<AriaCore>) -> Result<(), anyhow::Error> {
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
