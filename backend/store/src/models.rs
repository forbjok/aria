use std::net::IpAddr;

use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, sqlx::Type)]
#[sqlx(type_name = "room")]
pub struct Room {
    pub id: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub name: Option<String>,
    pub claimed_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub password: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, sqlx::Type)]
#[sqlx(type_name = "post")]
pub struct Post {
    pub id: Option<i64>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub room_id: Option<i32>,
    pub name: Option<String>,
    pub comment: Option<String>,
    pub ip: Option<IpAddr>,
    pub is_deleted: bool,
    pub user_id: Option<i64>,
    pub admin: bool,
}

#[derive(Debug, sqlx::Type)]
#[sqlx(type_name = "image")]
pub struct Image {
    pub id: Option<i64>,
    pub post_id: Option<i64>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub filename: Option<String>,
    pub hash: Option<String>,
    pub ext: Option<String>,
    pub tn_ext: Option<String>,
}

#[derive(Debug)]
pub struct PostAndImage {
    pub post: Post,
    pub image: Option<Image>,
}

#[derive(Debug, sqlx::Type)]
#[sqlx(type_name = "new_post")]
pub struct NewPost {
    pub name: Option<String>,
    pub comment: Option<String>,
    pub ip: Option<IpAddr>,
    pub user_id: i64,
    pub admin: bool,
}

#[derive(Debug, sqlx::Type)]
#[sqlx(type_name = "new_image")]
pub struct NewImage {
    pub filename: Option<String>,
    pub hash: Option<String>,
    pub ext: Option<String>,
    pub tn_ext: Option<String>,
}

#[derive(Debug, sqlx::Type)]
#[sqlx(type_name = "emote")]
pub struct Emote {
    pub id: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub room_id: Option<i32>,
    pub name: Option<String>,
    pub hash: Option<String>,
    pub ext: Option<String>,
}

#[derive(Debug, sqlx::Type)]
#[sqlx(type_name = "new_emote")]
pub struct NewEmote {
    pub name: Option<String>,
    pub hash: Option<String>,
    pub ext: Option<String>,
}

#[derive(Debug, sqlx::Type)]
#[sqlx(type_name = "refresh_refresh_token_result")]
pub struct RefreshRefreshTokenResult {
    pub token: Option<Uuid>,
    pub claims: Option<String>,
}
