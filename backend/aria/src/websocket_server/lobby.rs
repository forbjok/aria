use std::{collections::HashMap, sync::Arc};

use anyhow::anyhow;
use futures::StreamExt;
use futures_channel::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::sync::mpsc::Sender;
use tokio::sync::{broadcast, oneshot};
use tracing::{error, info, warn};

use aria_core::{AriaCore, Notification};

use super::room::RoomMembership;
use super::{room::Room, Tx};

pub(super) struct Lobby {
    tx: UnboundedSender<LobbyRequest>,
}

#[derive(Default)]
struct LobbyState {
    rooms_by_id: HashMap<i32, Room>,
    rooms_by_name: HashMap<String, Room>,
}

pub(super) enum LobbyRequest {
    JoinRoom {
        name: String,
        member_tx: Tx,
        user_id: i64,
        result_tx: oneshot::Sender<Result<RoomMembership, anyhow::Error>>,
    },
    UnloadRoom {
        room_id: i32,
        result_tx: oneshot::Sender<Result<(), anyhow::Error>>,
    },
}

impl Lobby {
    pub fn new(core: Arc<AriaCore>, shutdown_rx: broadcast::Receiver<()>, shutdown_complete_tx: Sender<()>) -> Self {
        let (tx, rx) = futures_channel::mpsc::unbounded::<LobbyRequest>();

        // Spawn lobby request handler
        tokio::spawn(handle_lobby_requests(
            core,
            tx.clone(),
            rx,
            shutdown_rx,
            shutdown_complete_tx,
        ));

        Self { tx }
    }

    pub async fn join_room(&self, name: String, member_tx: Tx, user_id: i64) -> Result<RoomMembership, anyhow::Error> {
        let (result_tx, result_rx) = oneshot::channel::<Result<RoomMembership, anyhow::Error>>();

        self.tx.unbounded_send(LobbyRequest::JoinRoom {
            name,
            member_tx,
            result_tx,
            user_id,
        })?;

        result_rx.await?
    }
}

async fn handle_lobby_requests(
    core: Arc<AriaCore>,
    request_tx: UnboundedSender<LobbyRequest>,
    mut request_rx: UnboundedReceiver<LobbyRequest>,
    mut shutdown_rx: broadcast::Receiver<()>,
    shutdown_complete_tx: Sender<()>,
) {
    let mut state = LobbyState::default();

    let (room_shutdown_tx, _) = broadcast::channel::<()>(1);

    let mut notify_rx = core.subscribe_notifications();

    loop {
        tokio::select! {
            // Handle lobby requests
            req = request_rx.select_next_some() => {
                match req {
                    LobbyRequest::JoinRoom { name, member_tx, user_id, result_tx } => {
                        result_tx.send(handle_join_room(&mut state, core.clone(), &request_tx, name, member_tx, user_id, room_shutdown_tx.subscribe(), shutdown_complete_tx.clone()).await).map_err(|_| {
                            warn!("Lobby request sender dropped.");
                        }).ok();
                    }
                    LobbyRequest::UnloadRoom { room_id, result_tx } => {
                        result_tx.send(handle_unload_room(&mut state, room_id)).map_err(|_| {
                            warn!("Lobby request sender dropped.");
                        }).ok();
                    }
                }
            }
            // Handle notifications
            result = notify_rx.recv() => {
                match result {
                    Ok(not) => {
                        let result: Result<(), anyhow::Error> = async {
                            match &*not {
                                Notification::NewPost(room, post) => {
                                    if let Some(room) = state.rooms_by_id.get(room) {
                                        room.post(post.clone()).await?;
                                    }
                                }
                                Notification::NewEmote(room, emote) => {
                                    if let Some(room) = state.rooms_by_id.get(room) {
                                        room.emote(emote.clone()).await?;
                                    }
                                }
                                Notification::DeletePost(room, post_id) => {
                                    if let Some(room) = state.rooms_by_id.get(room) {
                                        room.delete_post(*post_id).await?;
                                    }
                                }
                                Notification::DeleteEmote(room, emote_id) => {
                                    if let Some(room) = state.rooms_by_id.get(room) {
                                        room.delete_emote(*emote_id).await?;
                                    }
                                }
                                Notification::Content(room, content) => {
                                    if let Some(room) = state.rooms_by_id.get(room) {
                                        room.set_content(content.clone()).await?;
                                    }
                                }
                            }

                            Ok(())
                        }
                        .await;

                        if let Err(err) = result {
                            error!("{err:#}");
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        warn!("Notification handler lagged.");
                        continue;
                    },
                    _ => break,
                };
            }
            _ = shutdown_rx.recv() => {
                info!("Shutting down lobby request handler...");
                break;
            }
        }
    }

    room_shutdown_tx.send(()).ok();
}

#[allow(clippy::too_many_arguments)]
async fn handle_join_room(
    state: &mut LobbyState,
    core: Arc<AriaCore>,
    lobby_request_tx: &UnboundedSender<LobbyRequest>,
    name: String,
    member_tx: Tx,
    user_id: i64,
    shutdown_rx: broadcast::Receiver<()>,
    shutdown_complete_tx: Sender<()>,
) -> Result<RoomMembership, anyhow::Error> {
    let room = if let Some(room) = state.rooms_by_name.get(&name) {
        room.clone()
    } else if let Some(room) =
        Room::load(core, &name, lobby_request_tx.clone(), shutdown_rx, shutdown_complete_tx).await?
    {
        state.rooms_by_id.insert(room.id, room.clone());
        state.rooms_by_name.insert(name.clone(), room.clone());

        room
    } else {
        return Err(anyhow!("Room '{name}' does not exist"));
    };

    room.join(member_tx, user_id).await
}

fn handle_unload_room(state: &mut LobbyState, room_id: i32) -> Result<(), anyhow::Error> {
    if let Some(room) = state.rooms_by_id.remove(&room_id) {
        state.rooms_by_name.remove(&room.name);

        info!("Room '{}' removed from lobby.", room.name);
    }

    Ok(())
}
