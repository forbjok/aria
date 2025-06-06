use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use futures::StreamExt;
use futures_channel::mpsc::UnboundedReceiver;
use futures_channel::mpsc::UnboundedSender;
use tokio::sync::broadcast;
use tokio::sync::mpsc::Sender;
use tokio::sync::oneshot;
use tracing::info;

use aria_core::AriaCore;
use aria_models::api as am;
use aria_models::local as lm;

use crate::websocket_server::ConnectionId;
use crate::websocket_server::lobby::LobbyRequest;

use super::Tx;
use super::state::RoomState;

type RoomRequestTx<R> = oneshot::Sender<Result<R, anyhow::Error>>;

pub enum RoomRequest {
    Join {
        tx: Tx,
        connection_id: ConnectionId,
        user_id: i64,
        result_tx: RoomRequestTx<()>,
    },
    SendEmotes {
        connection_id: ConnectionId,
        since_id: i32,
        result_tx: RoomRequestTx<()>,
    },
    SendRecentPosts {
        connection_id: ConnectionId,
        since_id: i64,
        result_tx: RoomRequestTx<()>,
    },
    Leave {
        connection_id: ConnectionId,
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
        connection_id: ConnectionId,
        result_tx: RoomRequestTx<()>,
    },
    SetMaster {
        connection_id: ConnectionId,
        result_tx: RoomRequestTx<()>,
    },
    RelinquishMaster {
        connection_id: ConnectionId,
        result_tx: RoomRequestTx<()>,
    },
    SetPlaybackState {
        connection_id: ConnectionId,
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
    core: Arc<AriaCore>,
    mut state: RoomState,
    mut request_rx: UnboundedReceiver<RoomRequest>,
    lobby_request_tx: UnboundedSender<LobbyRequest>,
    mut shutdown_rx: broadcast::Receiver<()>,
    _shutdown_complete_tx: Sender<()>,
) {
    let mut unload_at: Option<DateTime<Utc>> = None;

    let mut unload_check_interval = tokio::time::interval(std::time::Duration::from_secs(900));

    loop {
        tokio::select! {
            // Handle room requests
            req = request_rx.select_next_some() => {
                match req {
                    RoomRequest::Join { tx, connection_id, user_id, result_tx } => {
                        let res = state.join(connection_id, user_id, tx);
                        result_tx.send(res).ok();

                        unload_at = None;
                    }
                    RoomRequest::SendEmotes { connection_id, since_id, result_tx } => {
                        let res = state.send_emotes(connection_id, since_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::SendRecentPosts { connection_id, since_id, result_tx } => {
                        let res = state.send_recent_posts(connection_id, since_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::Leave { connection_id, result_tx } => {
                        let res = state.leave(connection_id);
                        result_tx.send(res).ok();

                        if state.is_deserted() {
                            info!("Room '{}' is deserted, unloading in 1 hour.", state.name);

                            unload_at = Some(Utc::now() + Duration::hours(1));
                        }
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
                    RoomRequest::SetAdmin { connection_id, result_tx } => {
                        let res = state.set_admin(connection_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::SetMaster { connection_id, result_tx } => {
                        let res = state.set_master(connection_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::RelinquishMaster { connection_id, result_tx } => {
                        let res = state.relinquish_master(connection_id);
                        result_tx.send(res).ok();
                    }
                    RoomRequest::SetPlaybackState { connection_id, ps, result_tx } => {
                        let res = state.set_playback_state(connection_id, &ps, &core).await;
                        result_tx.send(res).ok();
                    }
                }
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(state.get_content_duration_remaining().map(|v| v as u64 + 1).unwrap_or(u64::MAX))) => {
                // Check whether content playback actually finished
                if let Some(remaining_duration) = state.get_content_duration_remaining() {
                    // If content is not actually finished, do nothing.
                    if remaining_duration > 0. {
                        continue;
                    }
                } else {
                    // If no remaining duration could be retrieved (no duration known, or not currently playing),
                    // do nothing.
                    continue;
                }

                // Reset server playback state
                let pbs = am::PlaybackState::default();
                state.set_playback_state(0, &pbs, &core).await.ok();
            }
            _ = unload_check_interval.tick() => {
                if let Some(unload_at) = unload_at {
                    if Utc::now() > unload_at {
                        info!("Unloading room '{}'...", state.name);

                        let (result_tx, result_rx) = oneshot::channel();
                        if lobby_request_tx.unbounded_send(LobbyRequest::UnloadRoom { room_id: state.id, result_tx }).is_ok() {
                            result_rx.await.ok();
                            break;
                        }
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
