mod api;

use std::sync::Arc;

use aria_core::AriaCore;
use rocket::fs::FileServer;

use crate::auth::AriaAuth;

use self::api::*;

pub struct AriaServer {
    auth: Arc<AriaAuth>,
    core: Arc<AriaCore>,
}

impl AriaServer {
    pub fn new(auth: Arc<AriaAuth>, core: Arc<AriaCore>) -> Self {
        Self { auth, core }
    }

    pub async fn run_server(self) -> Result<(), anyhow::Error> {
        let _result = rocket::build()
            .mount("/f", FileServer::from(&self.core.public_path))
            .mount_api("/api")
            .manage(self)
            .launch()
            .await
            .unwrap();

        Ok(())
    }
}
