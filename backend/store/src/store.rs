use anyhow::Context;
use async_trait::async_trait;

use crate::models as dbm;

#[derive(Debug)]
pub enum StoreError {
    NotFound,
    Other(String),
}

#[async_trait]
pub trait AriaStore: Send + Sync {
    async fn get_recent_posts(&self, room: &str) -> Result<Vec<dbm::PostAndImage>, anyhow::Error>;

    async fn get_room(&self, name: &str) -> Result<Option<dbm::Room>, anyhow::Error>;

    async fn create_room(&self, name: &str, password: &str) -> Result<dbm::Room, anyhow::Error>;

    async fn create_post(
        &self,
        room: &str,
        post: &dbm::NewPost,
        image: Option<&dbm::NewImage>,
    ) -> Result<dbm::PostAndImage, anyhow::Error>;

    async fn create_emote(&self, room: &str, emote: &dbm::NewEmote) -> Result<i32, anyhow::Error>;

    async fn set_room_content(&self, room: &str, content: &str) -> Result<(), anyhow::Error>;

    async fn update_post_images(&self, hash: &str, ext: &str, tn_ext: &str) -> Result<(), anyhow::Error>;

    async fn update_emote_images(&self, hash: &str, ext: &str) -> Result<(), anyhow::Error>;
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
    async fn get_recent_posts(&self, room: &str) -> Result<Vec<dbm::PostAndImage>, anyhow::Error> {
        let mut posts = sqlx::query_as_unchecked!(
            dbm::PostAndImage,
            r#"SELECT post, image FROM get_posts($1) ORDER BY (post).id DESC LIMIT 50;"#,
            room,
        )
        .fetch_all(&self.pool)
        .await
        .context("Error getting recent posts")?;

        if posts.is_empty() {
            return Ok(Vec::new());
        }

        // Reverse posts, as they are returned in reverse order
        posts.reverse();

        Ok(posts)
    }

    async fn get_room(&self, name: &str) -> Result<Option<dbm::Room>, anyhow::Error> {
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
        room: &str,
        post: &dbm::NewPost,
        image: Option<&dbm::NewImage>,
    ) -> Result<dbm::PostAndImage, anyhow::Error> {
        let post = sqlx::query_as_unchecked!(
            dbm::PostAndImage,
            r#"SELECT * FROM create_post($1, $2, $3);"#,
            room,
            post,
            image,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(post)
    }

    async fn create_emote(&self, room: &str, emote: &dbm::NewEmote) -> Result<i32, anyhow::Error> {
        let no = sqlx::query_scalar_unchecked!(r#"SELECT id FROM create_emote($1, $2);"#, room, emote,)
            .fetch_one(&self.pool)
            .await?;

        Ok(no.unwrap())
    }

    async fn set_room_content(&self, room: &str, content: &str) -> Result<(), anyhow::Error> {
        sqlx::query_unchecked!(r#"SELECT set_room_content($1, $2::json);"#, room, content)
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
}
