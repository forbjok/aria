mod handler;
mod membership;
mod state;

use std::sync::Arc;

use futures_channel::mpsc::UnboundedSender;
use tokio::sync::broadcast;
use tokio::sync::mpsc::Sender;

use aria_core::AriaCore;
use aria_models::api as am;
use aria_models::local as lm;

use self::handler::RoomRequest;
use self::handler::send_room_request;
pub use self::membership::RoomMembership;
use self::state::RoomState;

use super::ConnectionId;
use super::lobby::LobbyRequest;
use super::{Tx, send};

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
        core: Arc<AriaCore>,
        name: &str,
        lobby_request_tx: UnboundedSender<LobbyRequest>,
        shutdown_rx: broadcast::Receiver<()>,
        shutdown_complete_tx: Sender<()>,
    ) -> Result<Option<Room>, anyhow::Error> {
        RoomState::load(core, name, lobby_request_tx, shutdown_rx, shutdown_complete_tx).await
    }

    pub async fn join(
        &self,
        connection_id: ConnectionId,
        tx: Tx,
        user_id: i64,
    ) -> Result<RoomMembership, anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::Join {
            tx,
            connection_id,
            user_id,
            result_tx,
        })
        .await?;

        Ok(RoomMembership {
            room_id: self.id,
            room_name: self.name.clone(),
            connection_id,
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
