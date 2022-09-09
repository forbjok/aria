mod connection;
mod notification;
mod room;

use std::{collections::HashMap, sync::Arc};

use aria_core::{AriaCore, Notification};
use futures::{pin_mut, Future};
use futures_channel::mpsc::{UnboundedReceiver, UnboundedSender};
use serde::Serialize;
use tokio::{
    net::TcpListener,
    sync::{broadcast, Mutex},
};
use tokio_tungstenite::tungstenite::Message;
use tracing::info;

use self::connection::*;
use self::notification::*;
use self::room::*;

type ConnectionId = u64;
type Tx = UnboundedSender<Message>;

struct ServerState {
    core: Arc<AriaCore>,
    rooms: Mutex<HashMap<String, Room>>,
}

#[derive(Debug, Serialize)]
struct ImageViewModel {
    filename: String,
    url: String,
    tn_url: String,
}

const LISTEN_ADDR: &str = "0.0.0.0:3001";

pub async fn run_server(
    core: Arc<AriaCore>,
    notify_rx: UnboundedReceiver<Notification>,
    shutdown: impl Future,
) -> Result<(), anyhow::Error> {
    let rooms = Mutex::new(HashMap::new());

    let state = Arc::new(ServerState { core, rooms });

    let listener = TcpListener::bind(LISTEN_ADDR).await?;
    info!("WebSocket server listening on: {LISTEN_ADDR}");

    let (shutdown_tx, shutdown_rx) = broadcast::channel::<()>(1);
    let (shutdown_complete_tx, mut shutdown_complete_rx) = tokio::sync::mpsc::channel(1);

    // Spawn notification receiver
    tokio::spawn(handle_notifications(
        state.clone(),
        notify_rx,
        shutdown_rx,
        shutdown_complete_tx.clone(),
    ));

    // Accept connections
    let mut next_id: ConnectionId = 0;

    pin_mut!(shutdown);

    loop {
        tokio::select! {
            res = listener.accept() => {
                if let Ok((stream, addr)) = res {
                    let id = next_id;
                    next_id += 1;

                    tokio::spawn(handle_connection(id, state.clone(), stream, addr, shutdown_tx.subscribe(), shutdown_complete_tx.clone()));
                }
            }
            _ = &mut shutdown => {
                info!("Stopped accepting connections.");
                break;
            }
        }
    }

    // Send shutdown signal
    shutdown_tx.send(())?;

    info!("Waiting for graceful shutdown...");

    // Wait for graceful shutdown of all connections
    drop(shutdown_complete_tx);
    shutdown_complete_rx.recv().await;

    info!("Graceful shutdown complete.");

    Ok(())
}

fn send_raw(tx: &Tx, msg: &str, data: &str) -> Result<(), anyhow::Error> {
    let msg = Message::Text(format!("{msg}|{data}"));
    tx.unbounded_send(msg)?;

    Ok(())
}

fn send<T: Serialize>(tx: &Tx, msg: &str, data: T) -> Result<(), anyhow::Error> {
    send_raw(tx, msg, &serde_json::to_string(&data)?)
}
