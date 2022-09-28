use futures_channel::mpsc::UnboundedSender;

use aria_models::api as am;

use super::handler::send_room_request;
use super::handler::RoomRequest;
use super::MemberId;

pub struct RoomMembership {
    pub id: i32,
    pub name: String,
    pub(super) member_id: MemberId,
    pub(super) tx: UnboundedSender<RoomRequest>,
}

impl RoomMembership {
    pub async fn leave(&self) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::Leave {
            member_id: self.member_id,
            result_tx,
        })
        .await
    }

    pub async fn set_admin(&self) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::SetAdmin {
            member_id: self.member_id,
            result_tx,
        })
        .await
    }

    pub async fn set_master(&self) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::SetMaster {
            member_id: self.member_id,
            result_tx,
        })
        .await
    }

    pub async fn relinquish_master(&self) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::RelinquishMaster {
            member_id: self.member_id,
            result_tx,
        })
        .await
    }

    pub async fn set_playback_state(&self, ps: am::PlaybackState) -> Result<(), anyhow::Error> {
        send_room_request(&self.tx, |result_tx| RoomRequest::SetPlaybackState {
            member_id: self.member_id,
            ps,
            result_tx,
        })
        .await
    }
}
