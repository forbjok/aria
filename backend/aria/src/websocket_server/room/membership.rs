use futures_channel::mpsc::UnboundedSender;

use aria_models::api as am;

use crate::websocket_server::ConnectionId;

use super::handler::send_room_request;
use super::handler::RoomRequest;

pub struct RoomMembership {
    pub connection_id: ConnectionId,
    pub room_id: i32,
    pub room_name: String,
    pub(super) tx: UnboundedSender<RoomRequest>,
}

impl RoomMembership {
    pub async fn leave(&self) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::Leave {
            connection_id: self.connection_id,
            result_tx,
        })
        .await
    }

    pub async fn set_admin(&self) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::SetAdmin {
            connection_id: self.connection_id,
            result_tx,
        })
        .await
    }

    pub async fn set_master(&self) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::SetMaster {
            connection_id: self.connection_id,
            result_tx,
        })
        .await
    }

    pub async fn relinquish_master(&self) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::RelinquishMaster {
            connection_id: self.connection_id,
            result_tx,
        })
        .await
    }

    pub async fn set_playback_state(&self, ps: am::PlaybackState) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::SetPlaybackState {
            connection_id: self.connection_id,
            ps,
            result_tx,
        })
        .await
    }
}
