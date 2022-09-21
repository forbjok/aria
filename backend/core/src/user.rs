use aria_store::AriaStore;

use super::AriaCore;

impl AriaCore {
    pub async fn generate_user_id(&self) -> Result<i64, anyhow::Error> {
        self.store.generate_user_id().await
    }
}
