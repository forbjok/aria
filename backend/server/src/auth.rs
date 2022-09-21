use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use serde::{de::DeserializeOwned, Deserialize, Serialize};

pub struct AriaAuth {
    keys: Keys,
}

#[derive(Debug)]
pub enum AuthError {
    TokenCreation,
    InvalidToken,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RoomClaims {
    pub exp: usize,
    pub room_id: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct UserClaims {
    pub exp: usize,
    pub user_id: i64,
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

    pub fn generate_token<T: Serialize>(&self, claims: &T) -> Result<String, AuthError> {
        let token = jsonwebtoken::encode(&Header::default(), &claims, &self.keys.encoding)
            .map_err(|_| AuthError::TokenCreation)?;

        Ok(token)
    }

    pub fn verify<T: DeserializeOwned>(&self, token: &str) -> Result<T, AuthError> {
        let token_data = jsonwebtoken::decode::<T>(token, &self.keys.decoding, &Validation::default())
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

impl RoomClaims {
    pub fn new(room_id: i32) -> Self {
        Self {
            exp: usize::MAX,
            room_id,
        }
    }
}

impl UserClaims {
    pub fn new(user_id: i64) -> Self {
        Self {
            exp: usize::MAX,
            user_id,
        }
    }
}
