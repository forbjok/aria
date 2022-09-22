use std::{net::SocketAddr, sync::Arc};

use anyhow::Context;
use futures::{pin_mut, StreamExt, TryStreamExt};
use futures_channel::mpsc::unbounded;
use serde::Deserialize;
use tokio::{
    net::TcpStream,
    sync::{broadcast, mpsc::Sender, Mutex},
};
use tracing::{error, info, warn};

use aria_models::api as am;

use crate::auth::{AuthClaims, UserClaims};

use super::{room::Room, send_raw, ConnectionId, ServerState, Tx};

struct ConnectionState {
    tx: Tx,
    room: Mutex<Option<i32>>,
}

#[derive(Debug, Deserialize)]
struct JoinRequest {
    room: String,
    user: String,
}

pub(super) async fn handle_connection(
    id: ConnectionId,
    sv_state: Arc<ServerState>,
    stream: TcpStream,
    addr: SocketAddr,
    mut shutdown_rx: broadcast::Receiver<()>,
    _shutdown_complete_tx: Sender<()>,
) {
    info!("[{id}] {addr} connected.");

    let ws_stream = tokio_tungstenite::accept_async(stream).await;

    if let Ok(ws_stream) = ws_stream {
        info!("[{id}] WebSocket connection established.");

        let (tx, rx) = unbounded();

        let (outgoing, incoming) = ws_stream.split();

        let cn_state = Arc::new(ConnectionState {
            tx,
            room: Mutex::new(None),
        });

        let handle_incoming = incoming.try_fold(
            (sv_state.clone(), cn_state.clone()),
            |(sv_state, cn_state), msg| async move {
                let result: Result<(), anyhow::Error> = (|| async {
                    let tx = &cn_state.tx;

                    let msg = msg.to_text().context("Error retrieving message text")?;
                    info!("[{id}] Message received: {}", msg);

                    if let Some((msg, data)) = msg.split_once('|') {
                        match msg {
                            "ping" => {
                                send_raw(tx, "pong", data)?;
                            }
                            "join" => {
                                let req: JoinRequest =
                                    serde_json::from_str(data).context("Error deserializing room name")?;

                                let user_claims = sv_state
                                    .auth
                                    .verify::<UserClaims>(&req.user)
                                    .map_err(|_| anyhow::anyhow!("Error verifying user token"))?;
                                let user_id = user_claims.user_id;

                                let room_name = req.room;

                                info!("[{id}] Joining room '{room_name}'...");

                                let mut rooms = sv_state.rooms.lock().await;

                                let room = {
                                    let mut room_ids_by_name = sv_state.room_ids_by_name.lock().await;

                                    if let Some(room_id) = room_ids_by_name.get(&room_name) {
                                        rooms.get_mut(room_id)
                                    } else if let Some(room) = sv_state.core.get_room_by_name(&room_name).await? {
                                        room_ids_by_name.insert(room_name, room.id);

                                        let new_room = Room::load(room.id, &sv_state.core).await?;
                                        rooms.insert(room.id, new_room);

                                        rooms.get_mut(&room.id)
                                    } else {
                                        None
                                    }
                                };

                                if let Some(room) = room {
                                    // If connection is already joined to another room...
                                    if let Some(&old_room_id) = cn_state.room.lock().await.as_ref() {
                                        // If connection is already joined to the same room, return immediately.
                                        if room.id == old_room_id {
                                            return Ok(());
                                        }

                                        return Err(anyhow::anyhow!("Already in a different room."));
                                    }

                                    room.join(id, user_id, tx.clone())?;
                                    *cn_state.room.lock().await = Some(room.id);
                                }
                            }
                            "leave" => {
                                if let Some(&room_id) = cn_state.room.lock().await.as_ref() {
                                    info!("[{id}] Leaving room {room_id}...");

                                    let mut rooms = sv_state.rooms.lock().await;
                                    let room = rooms.get_mut(&room_id);

                                    if let Some(room) = room {
                                        room.leave(id).context("leaving room")?;
                                    }
                                } else {
                                    warn!("[{id}] Tried to leave the room, but was not in a room.");
                                }
                            }
                            "auth" => {
                                let token: String =
                                    serde_json::from_str(data).context("Error deserializing authorization token")?;

                                if let Some(&room_id) = cn_state.room.lock().await.as_ref() {
                                    let mut is_authorized = false;
                                    if let Ok(claims) = sv_state.auth.verify::<AuthClaims>(&token) {
                                        if claims.for_room(room_id) {
                                            is_authorized = true;
                                        }
                                    }

                                    if is_authorized {
                                        let mut rooms = sv_state.rooms.lock().await;
                                        if let Some(room) = rooms.get_mut(&room_id) {
                                            room.set_admin(id).context("setting admin")?;
                                        }
                                    }
                                }
                            }
                            "set-master" => {
                                if let Some(&room_id) = cn_state.room.lock().await.as_ref() {
                                    let mut rooms = sv_state.rooms.lock().await;
                                    if let Some(room) = rooms.get_mut(&room_id) {
                                        room.set_master(id).context("setting master")?;
                                    }
                                }
                            }
                            "not-master" => {
                                if let Some(room) = cn_state.room.lock().await.as_ref() {
                                    let mut rooms = sv_state.rooms.lock().await;
                                    if let Some(room) = rooms.get_mut(room) {
                                        room.relinquish_master(id).context("relinquishing master")?;
                                    }
                                }
                            }
                            "master-playbackstate" => {
                                let ps: am::PlaybackState =
                                    serde_json::from_str(data).context("deserializing playback state")?;

                                if let Some(room) = cn_state.room.lock().await.as_ref() {
                                    let mut rooms = sv_state.rooms.lock().await;
                                    if let Some(room) = rooms.get_mut(room) {
                                        room.set_playback_state(id, &ps).context("setting playback state")?;
                                    }
                                }
                            }
                            _ => {
                                warn!("Unknown message: {msg}");
                            }
                        }
                    }

                    Ok(())
                })()
                .await;

                if let Err(err) = result {
                    error!("{err:#}");
                }

                Ok((sv_state, cn_state))
            },
        );

        let handle_outgoing = rx.map(Ok).forward(outgoing);

        pin_mut!(handle_incoming, handle_outgoing);

        // Continue to handle incoming and outgoing messages
        // until the shutdown signal is received.
        tokio::select! {
            _ = handle_incoming => { },
            _ = handle_outgoing => { },
            _ = shutdown_rx.recv() => { },
        }

        info!("[{id}] Disconnected.");

        // Leave the room, to prevent dangling members
        if let Some(room) = cn_state.room.lock().await.as_ref() {
            if let Some(room) = sv_state.rooms.lock().await.get_mut(room) {
                room.leave(id).ok();
            }
        };
    } else {
        error!("[{id}] Error occurred during the websocket handshake.");
    }
}
