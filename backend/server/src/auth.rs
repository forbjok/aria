use hmac::{Hmac, Mac};
use jwt::{SignWithKey, VerifyWithKey};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

pub struct AriaAuth {
    key: Hmac<Sha256>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Claims {
    pub room_id: i32,
}

impl AriaAuth {
    pub fn new(secret: &[u8]) -> Self {
        let key: Hmac<Sha256> = Hmac::new_from_slice(secret).unwrap();

        Self { key }
    }

    pub fn generate_token(&self, claims: &Claims) -> Result<String, anyhow::Error> {
        let token = claims.sign_with_key(&self.key)?;

        Ok(token)
    }

    pub fn verify(&self, token: &str) -> Option<Claims> {
        token.verify_with_key(&self.key).ok()
    }
}
