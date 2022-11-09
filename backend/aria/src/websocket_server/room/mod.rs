mod handler;
mod membership;
mod state;

use futures_channel::mpsc::UnboundedSender;
use tokio::sync::broadcast;
use tokio::sync::mpsc::Sender;

use aria_core::AriaCore;
use aria_models::api as am;
use aria_models::local as lm;

use self::handler::send_room_request;
use self::handler::RoomRequest;
pub use self::membership::RoomMembership;
use self::state::RoomState;

use super::lobby::LobbyRequest;
use super::{send, Tx};

pub type MemberId = u64;

struct Member {
    user_id: i64,
    is_admin: bool,
    tx: Tx,
}

#[derive(Clone)]
pub(super) struct Room {
    pub id: i32,
    pub name: String,
    tx: UnboundedSender<RoomRequest>,
}

impl Room {
    pub async fn load(
        core: &AriaCore,
        name: &str,
        lobby_request_tx: UnboundedSender<LobbyRequest>,
        shutdown_rx: broadcast::Receiver<()>,
        shutdown_complete_tx: Sender<()>,
    ) -> Result<Option<Room>, anyhow::Error> {
        RoomState::load(core, name, lobby_request_tx, shutdown_rx, shutdown_complete_tx).await
    }

    pub async fn join(&self, tx: Tx, user_id: i64) -> Result<RoomMembership, anyhow::Error> {
        let member_id = send_room_request(&self.tx, |result_tx| RoomRequest::Join { tx, user_id, result_tx }).await?;

        Ok(RoomMembership {
            id: self.id,
            name: self.name.clone(),
            member_id,
            tx: self.tx.clone(),
        })
    }

    pub async fn post(&self, post: lm::Post) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::Post { post, result_tx }).await
    }

    pub async fn delete_post(&self, post_id: i64) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::DeletePost { post_id, result_tx }).await
    }

    pub async fn emote(&self, emote: lm::Emote) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::Emote { emote, result_tx }).await
    }

    pub async fn delete_emote(&self, emote_id: i32) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::DeleteEmote { emote_id, result_tx }).await
    }

    pub async fn set_content(&self, content: am::Content) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::SetContent { content, result_tx }).await
    }
}
