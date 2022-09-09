mod api;

use std::sync::Arc;

use aria_core::AriaCore;
use hmac::{Hmac, Mac};
use jwt::SignWithKey;
use rocket::fs::FileServer;
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use self::api::*;

pub struct AriaServer {
    core: Arc<AriaCore>,
    key: Hmac<Sha256>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Claims {
    pub name: String,
}

impl AriaServer {
    pub fn new(core: Arc<AriaCore>) -> Self {
        let key: Hmac<Sha256> = Hmac::new_from_slice(b"sekrit").unwrap();

        Self { core, key }
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

    pub fn generate_room_token(&self, name: &str) -> Result<String, anyhow::Error> {
        let claims = Claims { name: name.to_owned() };

        let token = claims.sign_with_key(&self.key)?;

        Ok(token)
    }
}
