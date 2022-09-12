use std::{net::SocketAddr, sync::Arc};

use anyhow::Context;
use futures::{pin_mut, StreamExt, TryStreamExt};
use futures_channel::mpsc::unbounded;
use tokio::{
    net::TcpStream,
    sync::{broadcast, mpsc::Sender, Mutex},
};
use tracing::{error, info, warn};

use aria_models::api as am;

use crate::websocket_server::send;

use super::{room::Room, send_raw, ConnectionId, ServerState, Tx};

struct ConnectionState {
    tx: Tx,
    room: Mutex<Option<String>>,
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
                                let room_name: String =
                                    serde_json::from_str(data).context("Error deserializing room name")?;

                                info!("[{id}] Joining room '{room_name}'...");

                                let mut rooms = sv_state.rooms.lock().await;

                                // If connection is already joined to another room...
                                if let Some(old_room) = cn_state.room.lock().await.as_ref() {
                                    // If connection is already joined to the same room, return immediately.
                                    if &room_name == old_room {
                                        return Ok(());
                                    }

                                    // ... otherwise, leave the previous room.
                                    if let Some(old_room) = rooms.get_mut(old_room) {
                                        old_room.leave(id).context("Error leaving old room")?;
                                    }
                                }

                                let mut room = rooms.get_mut(&room_name);

                                // If room is not loaded, load it...
                                if room.is_none() {
                                    let new_room = Room::load(&room_name, &sv_state.core).await?;
                                    rooms.insert(room_name.clone(), new_room);

                                    room = rooms.get_mut(&room_name);
                                }

                                if let Some(room) = room {
                                    room.join(id, tx.clone())?;
                                    *cn_state.room.lock().await = Some(room_name);
                                }
                            }
                            "leave" => {
                                let room_name: String =
                                    serde_json::from_str(data).context("Error deserializing room name")?;

                                info!("[{id}] Leaving room '{room_name}'...");

                                let mut rooms = sv_state.rooms.lock().await;
                                let room = rooms.get_mut(&room_name);

                                if let Some(room) = room {
                                    room.leave(id).context("leaving room")?;
                                }
                            }
                            "set-master" => {
                                let token: String =
                                    serde_json::from_str(data).context("Error deserializing authorization token")?;

                                if let Some(room) = cn_state.room.lock().await.as_ref() {
                                    let mut is_authorized = false;
                                    if let Some(claims) = sv_state.auth.verify(&token) {
                                        if &claims.name == room {
                                            is_authorized = true;
                                        }
                                    }

                                    if is_authorized {
                                        let mut rooms = sv_state.rooms.lock().await;
                                        if let Some(room) = rooms.get_mut(room) {
                                            room.set_master(id).context("setting master")?;
                                        }
                                    } else {
                                        send(tx, "not-master", ())?;
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
