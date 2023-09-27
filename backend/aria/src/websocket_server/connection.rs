use std::{net::SocketAddr, sync::Arc};

use anyhow::Context;
use futures::{pin_mut, StreamExt};
use futures_channel::mpsc::unbounded;
use serde::Deserialize;
use tokio::{
    net::TcpStream,
    sync::{broadcast, mpsc::Sender},
};
use tracing::{error, info, warn};

use aria_models::api as am;

use crate::auth::{AuthClaims, UserClaims};

use super::{room::RoomMembership, send_raw, ConnectionId, ServerState, Tx};

struct ConnectionState {
    tx: Tx,
    room: Option<RoomMembership>,
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

        let (outgoing, mut incoming) = ws_stream.split();

        let mut cn_state = ConnectionState { tx, room: None };

        let handle_outgoing = rx.map(Ok).forward(outgoing);

        pin_mut!(handle_outgoing);

        // Continue to handle incoming and outgoing messages
        // until the shutdown signal is received.
        loop {
            tokio::select! {
                msg = incoming.next() => {
                    if let Some(Ok(msg)) = msg {
                        let sv_state = &sv_state;
                        let cn_state = &mut cn_state;

                        let result: Result<(), anyhow::Error> = async move {
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

                                        // If connection is already joined to another room...
                                        if let Some(room) = cn_state.room.as_ref() {
                                            // If connection is already joined to the same room, return immediately.
                                            if room.name == room_name {
                                                return Ok(());
                                            }

                                            // Otherwise, leave the current room before joining the new one.
                                            room.leave().await?;
                                        }

                                        let room =
                                            sv_state.lobby.join_room(room_name, tx.clone(), user_id).await?;

                                        cn_state.room = Some(room);
                                    }
                                    "leave" => {
                                        if let Some(room) = cn_state.room.as_ref() {
                                            info!("[{id}] Leaving room '{}'...", room.name);

                                            room.leave().await?;
                                        } else {
                                            warn!("[{id}] Tried to leave the room, but was not in a room.");
                                        }
                                    }
                                    "auth" => {
                                        let token: String =
                                            serde_json::from_str(data).context("Error deserializing authorization token")?;

                                        if let Some(room) = cn_state.room.as_ref() {
                                            let mut is_authorized = false;
                                            if let Ok(claims) = sv_state.auth.verify::<AuthClaims>(&token) {
                                                if claims.for_room(room.id) {
                                                    is_authorized = true;
                                                }
                                            }

                                            if is_authorized {
                                                room.set_admin().await.context("setting admin")?;
                                            }
                                        }
                                    }
                                    "set-master" => {
                                        if let Some(room) = cn_state.room.as_ref() {
                                            room.set_master().await.context("setting master")?;
                                        }
                                    }
                                    "not-master" => {
                                        if let Some(room) = cn_state.room.as_ref() {
                                            room
                                                .relinquish_master()
                                                .await
                                                .context("relinquishing master")?;
                                        }
                                    }
                                    "master-playbackstate" => {
                                        let ps: am::PlaybackState =
                                            serde_json::from_str(data).context("deserializing playback state")?;

                                        if let Some(room) = cn_state.room.as_ref() {
                                            room
                                                .set_playback_state(ps)
                                                .await
                                                .context("setting playback state")?;
                                        }
                                    }
                                    _ => {
                                        warn!("Unknown message: {msg}");
                                    }
                                }
                            }

                            Ok(())
                        }
                        .await;

                        if let Err(err) = result {
                            error!("{err:#}");
                        }
                    } else {
                        // If incoming returns None, break.
                        // This is necessary to avoid going into an infinite loop.
                        break;
                    }
                },
                _ = &mut handle_outgoing => { },
                _ = shutdown_rx.recv() => { break; },
            }
        }

        info!("[{id}] Disconnected.");

        // Leave the room, to prevent dangling members
        if let Some(room) = cn_state.room.as_ref() {
            room.leave().await.ok();
        };
    } else {
        error!("[{id}] Error occurred during the websocket handshake.");
    }
}
