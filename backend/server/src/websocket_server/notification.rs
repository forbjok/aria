use std::sync::Arc;

use futures::StreamExt;
use futures_channel::mpsc::UnboundedReceiver;
use tokio::sync::{broadcast, mpsc::Sender};
use tracing::{error, info};

use aria_core::Notification;

use super::ServerState;

pub(super) async fn handle_notifications(
    state: Arc<ServerState>,
    mut rx: UnboundedReceiver<Notification>,
    mut shutdown_rx: broadcast::Receiver<()>,
    _shutdown_complete_tx: Sender<()>,
) {
    loop {
        tokio::select! {
            not = rx.select_next_some() => {
                let result: Result<(), anyhow::Error> = (|| async {
                    match not {
                        Notification::NewPost(room, post) => {
                            let mut rooms = state.rooms.lock().await;
                            if let Some(room) = rooms.get_mut(&room) {
                                room.post(&post)?;
                            }
                        }
                        Notification::NewEmote(room, emote) => {
                            let mut rooms = state.rooms.lock().await;
                            if let Some(room) = rooms.get_mut(&room) {
                                room.add_emote(&emote)?;
                            }
                        }
                        Notification::DeletePost(room, post_id) => {
                            let mut rooms = state.rooms.lock().await;
                            if let Some(room) = rooms.get_mut(&room) {
                                room.delete_post(post_id)?;
                            }
                        }
                        Notification::DeleteEmote(room, emote_id) => {
                            let mut rooms = state.rooms.lock().await;
                            if let Some(room) = rooms.get_mut(&room) {
                                room.delete_emote(emote_id)?;
                            }
                        }
                        Notification::Content(room, content) => {
                            let mut rooms = state.rooms.lock().await;
                            if let Some(room) = rooms.get_mut(&room) {
                                room.content(&content)?;
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
            _ = shutdown_rx.recv() => {
                info!("Shutting down notification handler...");
                break;
            }
        }
    }
}
