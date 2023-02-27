mod api;

use std::{net::SocketAddr, sync::Arc};

use aria_core::AriaCore;
use axum::Router;
use futures::Future;
use tower_http::services::ServeDir;
use tracing::info;

use crate::auth::AriaAuth;

pub struct AriaServer {
    auth: Arc<AriaAuth>,
    core: Arc<AriaCore>,
}

impl AriaServer {
    pub fn new(auth: Arc<AriaAuth>, core: Arc<AriaCore>) -> Self {
        Self { auth, core }
    }

    pub async fn run_server(self, shutdown: impl Future<Output = ()>) -> Result<(), anyhow::Error> {
        let public_path = self.core.public_path.clone();

        let server = Arc::new(self);

        let api = api::router();

        let app = Router::new()
            .nest("/api", api)
            .nest_service("/f", ServeDir::new(public_path))
            .layer(tower_http::trace::TraceLayer::new_for_http())
            .with_state(server);

        let addr = "[::]:3000".parse().unwrap();

        info!("Web server listening on: {addr}");
        axum::Server::bind(&addr)
            .serve(app.into_make_service_with_connect_info::<SocketAddr>())
            .with_graceful_shutdown(shutdown)
            .await?;

        Ok(())
    }
}
