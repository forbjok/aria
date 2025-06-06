mod api;

use std::{net::SocketAddr, sync::Arc};

use aria_core::AriaCore;
use axum::Router;
use axum_client_ip::ClientIpSource;
use futures::Future;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;
use tracing::info;

use crate::auth::AriaAuth;

pub struct AriaServer {
    auth: Arc<AriaAuth>,
    core: Arc<AriaCore>,
    serve_files: bool,
}

impl AriaServer {
    pub fn new(auth: Arc<AriaAuth>, core: Arc<AriaCore>, serve_files: bool) -> Self {
        Self {
            auth,
            core,
            serve_files,
        }
    }

    pub async fn run_server(self, shutdown: impl Future<Output = ()> + Send + 'static) -> Result<(), anyhow::Error> {
        let public_path = self.core.public_path.clone();

        let server = Arc::new(self);

        let api = api::router(&server.core.sys_config);

        let mut app = Router::new().nest("/api", api);

        // If file serving is enabled, serve public files under /f.
        // This should generally only be used for development.
        // On a production deployment, the public file path should
        // be served directly through a dedicated HTTP server instead.
        if server.serve_files {
            app = app.nest_service("/f", ServeDir::new(public_path))
        }

        let app = app
            .layer(tower_http::trace::TraceLayer::new_for_http())
            .layer(ClientIpSource::RightmostXForwardedFor.into_extension())
            .with_state(server);

        let addr: SocketAddr = "[::]:3000".parse().unwrap();

        info!("Web server listening on: {addr}");
        let listener = TcpListener::bind(&addr).await?;
        axum::serve(listener, app).with_graceful_shutdown(shutdown).await?;

        Ok(())
    }
}
