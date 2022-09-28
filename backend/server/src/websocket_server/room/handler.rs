use futures::StreamExt;
use futures_channel::mpsc::UnboundedReceiver;
use futures_channel::mpsc::UnboundedSender;
use tokio::sync::broadcast;
use tokio::sync::mpsc::Sender;
use tokio::sync::oneshot;
use tracing::info;

use aria_models::api as am;
use aria_models::local as lm;

use super::state::RoomState;
use super::MemberId;
use super::Tx;

type RoomRequestTx<R> = oneshot::Sender<Result<R, anyhow::Error>>;

pub enum RoomRequest {
    Join {
        tx: Tx,
        user_id: i64,
        result_tx: RoomRequestTx<MemberId>,
    },
    Leave {
        member_id: MemberId,
        result_tx: RoomRequestTx<()>,
    },
    Post {
        post: lm::Post,
        result_tx: RoomRequestTx<()>,
    },
    DeletePost {
        post_id: i64,
        result_tx: RoomRequestTx<()>,
    },
    SetContent {
        content: am::Content,
        result_tx: RoomRequestTx<()>,
    },
    SetAdmin {
        member_id: MemberId,
        result_tx: RoomRequestTx<()>,
    },
    SetMaster {
        member_id: MemberId,
        result_tx: RoomRequestTx<()>,
    },
    RelinquishMaster {
        member_id: MemberId,
        result_tx: RoomRequestTx<()>,
    },
    SetPlaybackState {
        member_id: MemberId,
        ps: am::PlaybackState,
        result_tx: RoomRequestTx<()>,
    },
    Emote {
        emote: lm::Emote,
        result_tx: RoomRequestTx<()>,
    },
    DeleteEmote {
        emote_id: i32,
        result_tx: RoomRequestTx<()>,
    },
}

pub(super) async fn handle_room_requests(
    mut state: RoomState,
    mut request_rx: UnboundedReceiver<RoomRequest>,
    mut shutdown_rx: broadcast::Receiver<()>,
    _shutdown_complete_tx: Sender<()>,
) {
    loop {
        tokio::select! {
            // Handle room requests
            req = request_rx.select_next_some() => {
                match req {
                    RoomRequest::Join { tx, user_id, result_tx } => {
                        let res = state.join(user_id, tx);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::Leave { member_id, result_tx } => {
                        let res = state.leave(member_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::Post { post, result_tx } => {
                        let res = state.post(post);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::DeletePost { post_id, result_tx } => {
                        let res = state.delete_post(post_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::Emote { emote, result_tx } => {
                        let res = state.add_emote(emote);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::DeleteEmote { emote_id, result_tx } => {
                        let res = state.delete_emote(emote_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::SetContent { content, result_tx } => {
                        let res = state.set_content(content);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::SetAdmin { member_id, result_tx } => {
                        let res = state.set_admin(member_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::SetMaster { member_id, result_tx } => {
                        let res = state.set_master(member_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::RelinquishMaster { member_id, result_tx } => {
                        let res = state.relinquish_master(member_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::SetPlaybackState { member_id, ps, result_tx } => {
                        let res = state.set_playback_state(member_id, &ps);
                        result_tx.send(res).ok();
                    }
                }
            }
            _ = shutdown_rx.recv() => {
                info!("Shutting down room request handler...");
                break;
            }
        }
    }
}

pub async fn send_room_request<F, R>(tx: &UnboundedSender<RoomRequest>, f: F) -> Result<R, anyhow::Error>
where
    F: FnOnce(oneshot::Sender<Result<R, anyhow::Error>>) -> RoomRequest,
{
    let (result_tx, result_rx) = oneshot::channel::<Result<R, anyhow::Error>>();

    let request = f(result_tx);
    tx.unbounded_send(request)?;

    result_rx.await?
}
