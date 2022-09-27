use std::{collections::HashMap, sync::Arc};

use anyhow::anyhow;
use futures::StreamExt;
use futures_channel::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::sync::mpsc::Sender;
use tokio::sync::oneshot;
use tokio::sync::{broadcast, Mutex};
use tracing::{error, info, warn};

use aria_core::{AriaCore, Notification};
use aria_models::api::PlaybackState;

use super::room::MemberId;
use super::{room::Room, Tx};

type RoomRequestFn = dyn FnOnce(&mut Room) -> Result<(), anyhow::Error> + Send + Sync;

pub struct Lobby {
    tx: UnboundedSender<LobbyRequest>,
}

#[derive(Default)]
struct LobbyState {
    rooms_by_id: HashMap<i32, Arc<Mutex<Room>>>,
    rooms_by_name: HashMap<String, Arc<Mutex<Room>>>,
}

enum LobbyRequest {
    JoinRoom {
        name: String,
        member_tx: Tx,
        user_id: i64,
        result_tx: oneshot::Sender<Result<RoomMembership, anyhow::Error>>,
    },
}

struct RoomRequest {
    room_id: i32,
    f: Box<RoomRequestFn>,
    result_tx: oneshot::Sender<Result<(), anyhow::Error>>,
}

pub struct RoomMembership {
    pub room_id: i32,
    pub room_name: String,
    member_id: MemberId,
    tx: UnboundedSender<RoomRequest>,
}

impl RoomMembership {
    pub async fn leave(&self) -> Result<(), anyhow::Error> {
        let id = self.member_id;
        self.execute(move |r| r.leave(id)).await
    }

    pub async fn set_admin(&self) -> Result<(), anyhow::Error> {
        let id = self.member_id;
        self.execute(move |r| r.set_admin(id)).await
    }

    pub async fn set_master(&self) -> Result<(), anyhow::Error> {
        let id = self.member_id;
        self.execute(move |r| r.set_master(id)).await
    }

    pub async fn relinquish_master(&self) -> Result<(), anyhow::Error> {
        let id = self.member_id;
        self.execute(move |r| r.relinquish_master(id)).await
    }

    pub async fn set_playback_state(&self, ps: PlaybackState) -> Result<(), anyhow::Error> {
        let id = self.member_id;
        self.execute(move |r| r.set_playback_state(id, &ps)).await
    }

    async fn execute<F>(&self, f: F) -> Result<(), anyhow::Error>
    where
        F: FnOnce(&mut Room) -> Result<(), anyhow::Error> + Send + Sync + 'static,
    {
        let (result_tx, result_rx) = oneshot::channel::<Result<(), anyhow::Error>>();
        self.tx.unbounded_send(RoomRequest {
            room_id: self.room_id,
            f: Box::new(f),
            result_tx,
        })?;

        result_rx.await?
    }
}

impl Lobby {
    pub fn new(core: Arc<AriaCore>, shutdown_rx: broadcast::Receiver<()>, shutdown_complete_tx: Sender<()>) -> Self {
        let (tx, rx) = futures_channel::mpsc::unbounded::<LobbyRequest>();

        // Spawn notification receiver
        tokio::spawn(handle_lobby_requests(core, rx, shutdown_rx, shutdown_complete_tx));

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
    mut request_rx: UnboundedReceiver<LobbyRequest>,
    mut shutdown_rx: broadcast::Receiver<()>,
    _shutdown_complete_tx: Sender<()>,
) {
    let mut state = LobbyState::default();

    let (room_request_tx, mut room_request_rx) = futures_channel::mpsc::unbounded::<RoomRequest>();

    let mut notify_rx = core.subscribe_notifications();

    loop {
        tokio::select! {
            // Handle lobby requests
            req = request_rx.select_next_some() => {
                let LobbyRequest::JoinRoom { name, member_tx, user_id, result_tx } = req;

                result_tx.send(handle_join_room(&mut state, core.clone(), room_request_tx.clone(), name, member_tx, user_id).await).map_err(|_| {
                    warn!("Lobby request sender dropped.");
                }).ok();
            }
            // Handle room requests
            req = room_request_rx.select_next_some() => {
                let RoomRequest { room_id, f, result_tx } = req;

                let result = if let Some(room) = state.rooms_by_id.get(&room_id) {
                    f(&mut *room.lock().await)
                } else {
                    Err(anyhow!("Room does not exist"))
                };

                result_tx.send(result).ok();
            }
            // Handle notifications
            result = notify_rx.recv() => {
                match result {
                    Ok(not) => {
                        let result: Result<(), anyhow::Error> = (|| async {
                            match &*not {
                                Notification::NewPost(room, post) => {
                                    if let Some(room) = state.rooms_by_id.get(room) {
                                        room.lock().await.post(post)?;
                                    }
                                }
                                Notification::NewEmote(room, emote) => {
                                    if let Some(room) = state.rooms_by_id.get(room) {
                                        room.lock().await.add_emote(emote)?;
                                    }
                                }
                                Notification::DeletePost(room, post_id) => {
                                    if let Some(room) = state.rooms_by_id.get(room) {
                                        room.lock().await.delete_post(*post_id)?;
                                    }
                                }
                                Notification::DeleteEmote(room, emote_id) => {
                                    if let Some(room) = state.rooms_by_id.get(room) {
                                        room.lock().await.delete_emote(*emote_id)?;
                                    }
                                }
                                Notification::Content(room, content) => {
                                    if let Some(room) = state.rooms_by_id.get(room) {
                                        room.lock().await.content(content)?;
                                    }
                                }
                            }

                            Ok(())
                        })()
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
                info!("Shutting down notification handler...");
                break;
            }
        }
    }
}

async fn handle_join_room(
    state: &mut LobbyState,
    core: Arc<AriaCore>,
    room_request_tx: UnboundedSender<RoomRequest>,
    name: String,
    member_tx: Tx,
    user_id: i64,
) -> Result<RoomMembership, anyhow::Error> {
    let room = if let Some(room) = state.rooms_by_name.get(&name) {
        room.clone()
    } else if let Some(room) = core.get_room_by_name(&name).await? {
        let new_room = Arc::new(Mutex::new(Room::load(room.id, &core).await?));

        state.rooms_by_id.insert(room.id, new_room.clone());
        state.rooms_by_name.insert(room.name.clone(), new_room.clone());

        new_room
    } else {
        return Err(anyhow!("Room '{name}' does not exist"));
    };

    let mut room = room.lock().await;

    let member_id = room.join(user_id, member_tx)?;

    Ok(RoomMembership {
        room_id: room.id,
        room_name: room.name.to_owned(),
        member_id,
        tx: room_request_tx,
    })
}
