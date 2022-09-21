use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

pub struct AriaAuth {
    keys: Keys,
}

#[derive(Debug)]
pub enum AuthError {
    TokenCreation,
    InvalidToken,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Claims {
    pub exp: usize,
    pub room_id: i32,
}

struct Keys {
    encoding: EncodingKey,
    decoding: DecodingKey,
}

impl AriaAuth {
    pub fn new(secret: &[u8]) -> Self {
        let keys = Keys::new(secret);

        Self { keys }
    }

    pub fn generate_token(&self, claims: &Claims) -> Result<String, AuthError> {
        let token = jsonwebtoken::encode(&Header::default(), &claims, &self.keys.encoding)
            .map_err(|_| AuthError::TokenCreation)?;

        Ok(token)
    }

    pub fn verify(&self, token: &str) -> Result<Claims, AuthError> {
        let token_data = jsonwebtoken::decode::<Claims>(token, &self.keys.decoding, &Validation::default())
            .map_err(|_| AuthError::InvalidToken)?;

        Ok(token_data.claims)
    }
}

impl Keys {
    fn new(secret: &[u8]) -> Self {
        Self {
            encoding: EncodingKey::from_secret(secret),
            decoding: DecodingKey::from_secret(secret),
        }
    }
}

impl Claims {
    pub fn new(room_id: i32) -> Self {
        Self {
            exp: usize::MAX,
            room_id,
        }
    }
}
