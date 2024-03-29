use anyhow::Context;
use async_trait::async_trait;
use uuid::Uuid;

use crate::models::{self as dbm, RefreshRefreshTokenResult};

#[async_trait]
pub trait AriaStore: Send + Sync {
    async fn migrate(&self) -> Result<(), anyhow::Error>;

    async fn get_recent_posts(&self, room_id: i32, count: i32) -> Result<Vec<dbm::PostAndImage>, anyhow::Error>;

    async fn get_room(&self, room_id: i32) -> Result<Option<dbm::Room>, anyhow::Error>;

    async fn get_room_by_name(&self, name: &str) -> Result<Option<dbm::Room>, anyhow::Error>;

    async fn create_room(&self, name: &str, password: &str) -> Result<dbm::Room, anyhow::Error>;

    async fn create_post(
        &self,
        room_id: i32,
        post: &dbm::NewPost,
        image: Option<&dbm::NewImage>,
    ) -> Result<dbm::PostAndImage, anyhow::Error>;

    async fn delete_post(
        &self,
        room_id: i32,
        post_id: i64,
        user_id: i64,
        is_admin: bool,
    ) -> Result<bool, anyhow::Error>;

    async fn get_emotes(&self, room_id: i32) -> Result<Vec<dbm::Emote>, anyhow::Error>;

    async fn create_emote(&self, room_id: i32, emote: &dbm::NewEmote) -> Result<dbm::Emote, anyhow::Error>;

    async fn delete_emote(&self, room_id: i32, emote_id: i32) -> Result<bool, anyhow::Error>;

    async fn set_room_content(&self, room_id: i32, content: &str) -> Result<(), anyhow::Error>;

    async fn set_room_playback_state(&self, room_id: i32, playback_state: &str) -> Result<(), anyhow::Error>;

    async fn update_post_images(&self, hash: &str, ext: &str, tn_ext: &str) -> Result<(), anyhow::Error>;

    async fn update_emote_images(&self, hash: &str, ext: &str) -> Result<(), anyhow::Error>;

    async fn generate_user_id(&self) -> Result<i64, anyhow::Error>;

    async fn create_refresh_token(&self, claims: &str) -> Result<Uuid, anyhow::Error>;

    async fn refresh_refresh_token(&self, token: Uuid) -> Result<RefreshRefreshTokenResult, anyhow::Error>;
}

pub struct PgStore {
    pool: sqlx::postgres::PgPool,
}

impl PgStore {
    pub fn new(uri: &str) -> Self {
        let pool = sqlx::PgPool::connect_lazy(uri).unwrap();

        Self { pool }
    }
}

#[async_trait]
impl AriaStore for PgStore {
    async fn migrate(&self) -> Result<(), anyhow::Error> {
        sqlx::migrate!().run(&self.pool).await?;

        Ok(())
    }

    async fn get_recent_posts(&self, room_id: i32, count: i32) -> Result<Vec<dbm::PostAndImage>, anyhow::Error> {
        let mut posts = sqlx::query_as_unchecked!(
            dbm::PostAndImage,
            r#"SELECT post, image FROM get_recent_posts($1, $2) ORDER BY (post).id DESC LIMIT 50;"#,
            room_id,
            count,
        )
        .fetch_all(&self.pool)
        .await
        .context("Error getting recent posts")?;

        // Reverse posts, as they are returned in reverse order
        posts.reverse();

        Ok(posts)
    }

    async fn get_room(&self, room_id: i32) -> Result<Option<dbm::Room>, anyhow::Error> {
        let room = sqlx::query_as_unchecked!(dbm::Room, r#"SELECT * FROM room WHERE id = $1;"#, room_id)
            .fetch_optional(&self.pool)
            .await
            .context("Error getting room")?;

        Ok(room)
    }

    async fn get_room_by_name(&self, name: &str) -> Result<Option<dbm::Room>, anyhow::Error> {
        let room = sqlx::query_as_unchecked!(dbm::Room, r#"SELECT * FROM get_room_by_name($1);"#, name)
            .fetch_optional(&self.pool)
            .await
            .context("Error getting room")?;

        Ok(room)
    }

    async fn create_room(&self, name: &str, password: &str) -> Result<dbm::Room, anyhow::Error> {
        let room = sqlx::query_as_unchecked!(dbm::Room, r#"SELECT * FROM create_room($1, $2);"#, name, password)
            .fetch_one(&self.pool)
            .await
            .context("Error creating room")?;

        Ok(room)
    }

    async fn create_post(
        &self,
        room_id: i32,
        post: &dbm::NewPost,
        image: Option<&dbm::NewImage>,
    ) -> Result<dbm::PostAndImage, anyhow::Error> {
        let post = sqlx::query_as_unchecked!(
            dbm::PostAndImage,
            r#"SELECT * FROM create_post($1, $2, $3);"#,
            room_id,
            post,
            image,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(post)
    }

    async fn delete_post(
        &self,
        room_id: i32,
        post_id: i64,
        user_id: i64,
        is_admin: bool,
    ) -> Result<bool, anyhow::Error> {
        let success = sqlx::query_scalar!(
            r#"SELECT delete_post($1, $2, $3, $4);"#,
            room_id,
            post_id,
            user_id,
            is_admin,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(success.unwrap())
    }

    async fn get_emotes(&self, room_id: i32) -> Result<Vec<dbm::Emote>, anyhow::Error> {
        let emotes = sqlx::query_as_unchecked!(dbm::Emote, r#"SELECT * FROM get_emotes($1);"#, room_id)
            .fetch_all(&self.pool)
            .await
            .context("Error getting emotes")?;

        Ok(emotes)
    }

    async fn create_emote(&self, room_id: i32, emote: &dbm::NewEmote) -> Result<dbm::Emote, anyhow::Error> {
        let emote = sqlx::query_as_unchecked!(dbm::Emote, r#"SELECT * FROM create_emote($1, $2);"#, room_id, emote)
            .fetch_one(&self.pool)
            .await?;

        Ok(emote)
    }

    async fn delete_emote(&self, room_id: i32, emote_id: i32) -> Result<bool, anyhow::Error> {
        let success = sqlx::query_scalar!(r#"SELECT delete_emote($1, $2);"#, room_id, emote_id)
            .fetch_one(&self.pool)
            .await?;

        Ok(success.unwrap())
    }

    async fn set_room_content(&self, room_id: i32, content: &str) -> Result<(), anyhow::Error> {
        sqlx::query_unchecked!(r#"SELECT set_room_content($1, $2::json);"#, room_id, content)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn set_room_playback_state(&self, room_id: i32, playback_state: &str) -> Result<(), anyhow::Error> {
        sqlx::query_unchecked!(
            r#"SELECT set_room_playback_state($1, $2::json);"#,
            room_id,
            playback_state
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_post_images(&self, hash: &str, ext: &str, tn_ext: &str) -> Result<(), anyhow::Error> {
        sqlx::query_unchecked!(r#"SELECT update_post_images($1, $2, $3);"#, hash, ext, tn_ext)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn update_emote_images(&self, hash: &str, ext: &str) -> Result<(), anyhow::Error> {
        sqlx::query_unchecked!(r#"SELECT update_emote_images($1, $2);"#, hash, ext)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn generate_user_id(&self) -> Result<i64, anyhow::Error> {
        let new_user_id = sqlx::query_scalar!(r#"SELECT nextval('user_id_seq');"#)
            .fetch_one(&self.pool)
            .await?
            .context("Error generating user id")?;

        Ok(new_user_id)
    }

    async fn create_refresh_token(&self, claims: &str) -> Result<Uuid, anyhow::Error> {
        let token = sqlx::query_scalar!(r#"SELECT create_refresh_token($1);"#, claims)
            .fetch_one(&self.pool)
            .await?
            .context("Error creating refresh token")?;

        Ok(token)
    }

    async fn refresh_refresh_token(&self, token: Uuid) -> Result<RefreshRefreshTokenResult, anyhow::Error> {
        let result = sqlx::query_as_unchecked!(
            RefreshRefreshTokenResult,
            r#"SELECT * FROM refresh_refresh_token($1);"#,
            token
        )
        .fetch_optional(&self.pool)
        .await?
        .context("Error refreshing refresh token")?;

        Ok(result)
    }
}
