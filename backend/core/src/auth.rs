use aria_models::local::RefreshRefreshTokenResult;
use aria_store::AriaStore;
use serde::{Serialize, de::DeserializeOwned};
use uuid::Uuid;

use super::AriaCore;

impl AriaCore {
    pub async fn create_refresh_token<T: Serialize>(&self, claims: &T) -> Result<Uuid, anyhow::Error> {
        let json = serde_json::to_string(claims)?;

        self.store.create_refresh_token(&json).await
    }

    pub async fn refresh_refresh_token<T: DeserializeOwned>(
        &self,
        token: Uuid,
    ) -> Result<Option<RefreshRefreshTokenResult<T>>, anyhow::Error> {
        let result = self.store.refresh_refresh_token(token).await?;
        if let (Some(token), Some(claims)) = (result.token, result.claims) {
            Ok(Some(RefreshRefreshTokenResult {
                token,
                claims: serde_json::from_str(&claims)?,
            }))
        } else {
            Ok(None)
        }
    }
}
