use std::collections::HashMap;
use std::collections::VecDeque;

use anyhow::Context;
use chrono::{DateTime, Utc};
use futures_channel::mpsc::UnboundedSender;
use tokio::sync::broadcast;
use tokio::sync::mpsc::Sender;
use tracing::{error, info};

use aria_core::AriaCore;
use aria_models::api as am;
use aria_models::local as lm;

use crate::websocket_server::lobby::LobbyRequest;

use super::handler::handle_room_requests;
use super::handler::RoomRequest;
use super::MemberId;
use super::Room;
use super::{send, Member, Tx};

const MAX_POSTS: usize = 50;

pub(super) struct RoomState {
    pub id: i32,
    pub name: String,
    next_member_id: MemberId,
    members: HashMap<MemberId, Member>,
    posts: VecDeque<lm::Post>,
    emotes: Vec<am::Emote>,
    master: MemberId,
    content: Option<am::Content>,
    playback_state_timestamp: DateTime<Utc>,
    playback_state: am::PlaybackState,
}

impl RoomState {
    pub async fn load(
        core: &AriaCore,
        name: &str,
        lobby_request_tx: UnboundedSender<LobbyRequest>,
        shutdown_rx: broadcast::Receiver<()>,
        shutdown_complete_tx: Sender<()>,
    ) -> Result<Option<Room>, anyhow::Error> {
        info!("Loading room '{name}'.");

        if let Some(room) = core.get_room_by_name(name).await.context("Getting room")? {
            let emotes = core.get_emotes(room.id).await.context("Error getting emotes")?;

            let recent_posts = core
                .get_recent_posts(room.id, MAX_POSTS as i32)
                .await
                .context("Error getting recent posts")?;

            // Prepare emotes
            let emotes = emotes.iter().map(am::Emote::from).collect();

            let state = RoomState {
                id: room.id,
                name: room.name.clone(),
                next_member_id: 1,
                members: HashMap::new(),
                posts: recent_posts.into_iter().collect(),
                emotes,
                master: 0,
                content: room.content,
                playback_state_timestamp: Utc::now(),
                playback_state: am::PlaybackState::default(),
            };

            let (tx, rx) = futures_channel::mpsc::unbounded::<RoomRequest>();

            // Spawn room request handler
            tokio::spawn(handle_room_requests(
                state,
                rx,
                lobby_request_tx,
                shutdown_rx,
                shutdown_complete_tx,
            ));

            Ok(Some(Room {
                id: room.id,
                name: room.name,
                tx,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn join(&mut self, user_id: i64, tx: Tx) -> Result<MemberId, anyhow::Error> {
        // Generate member ID
        let id = self.next_member_id;
        self.next_member_id += 1;

        let member = Member {
            user_id,
            is_admin: false,
            tx: tx.clone(),
        };
        self.members.insert(id, member);

        send(&tx, "content", &self.content)?;
        send(&tx, "playbackstate", &self.get_playback_state())?;

        self.send_emotes(&tx)?;
        self.send_recent_posts(&tx, user_id)?;
        send(&tx, "joined", ())?;

        Ok(id)
    }

    pub fn leave(&mut self, id: MemberId) -> Result<(), anyhow::Error> {
        self.members.remove(&id);
        Ok(())
    }

    pub fn send_recent_posts(&self, tx: &Tx, user_id: i64) -> Result<(), anyhow::Error> {
        let posts: Vec<_> = self
            .posts
            .iter()
            .map(|p| {
                let mut post = am::Post::from(p);
                post.you = p.user_id == user_id;

                post
            })
            .collect();

        send(tx, "oldposts", &posts)?;

        Ok(())
    }

    /// Add post
    pub fn post(&mut self, post: lm::Post) -> Result<(), anyhow::Error> {
        // If the maximum number of posts is reached, remove the oldest one.
        if self.posts.len() >= MAX_POSTS {
            self.posts.pop_front();
        }

        let mut post_am = am::Post::from(&post);
        let post_user_id = post.user_id;

        self.posts.push_back(post);

        for m in self.members.values() {
            post_am.you = post_user_id == m.user_id;

            send(&m.tx, "post", &post_am).map_err(|err| error!("{err:?}")).ok();
        }

        Ok(())
    }

    /// Delete post
    pub fn delete_post(&mut self, post_id: i64) -> Result<(), anyhow::Error> {
        self.posts.retain(|p| p.id != post_id);

        for m in self.members.values() {
            send(&m.tx, "delete-post", post_id)
                .map_err(|err| error!("{err:?}"))
                .ok();
        }

        Ok(())
    }

    pub fn set_content(&mut self, content: am::Content) -> Result<(), anyhow::Error> {
        // Set content
        self.content = Some(content);

        // Reset playback time
        self.playback_state.time = 0.;

        // Broadcast content change to members
        self.send_content()?;
        self.broadcast_playback_state()?;

        Ok(())
    }

    pub fn set_admin(&mut self, id: MemberId) -> Result<(), anyhow::Error> {
        let me = self.members.get_mut(&id).context("Error getting member")?;

        me.is_admin = true;

        Ok(())
    }

    pub fn set_master(&mut self, id: MemberId) -> Result<(), anyhow::Error> {
        // If already master, return immediately.
        if self.master == id {
            return Ok(());
        }

        let me = self.members.get(&id).context("Error getting member")?;
        if !me.is_admin {
            return Err(anyhow::anyhow!("User is not an admin. Master denied."));
        }

        // Notify the previous master that it is no longer mater.
        if let Some(old_master) = self.members.get(&self.master) {
            send(&old_master.tx, "not-master", ())?;
        }

        // Set new master
        self.master = id;

        Ok(())
    }

    pub fn relinquish_master(&mut self, id: MemberId) -> Result<(), anyhow::Error> {
        // If this id is not master, return immediately.
        if self.master != id {
            return Ok(());
        }

        // Clear master
        self.master = 0;

        Ok(())
    }

    pub fn set_playback_state(&mut self, id: MemberId, ps: &am::PlaybackState) -> Result<(), anyhow::Error> {
        // Sender is not master. Ignore.
        if id != self.master {
            return Ok(());
        }

        self.playback_state_timestamp = Utc::now();
        self.playback_state = *ps;
        self.broadcast_playback_state()?;

        Ok(())
    }

    pub fn broadcast_playback_state(&self) -> Result<(), anyhow::Error> {
        let ps = self.get_playback_state();

        for m in self.members.values() {
            send(&m.tx, "playbackstate", &ps).map_err(|err| error!("{err:?}")).ok();
        }

        Ok(())
    }

    /// Add or update emote
    pub fn add_emote(&mut self, emote: lm::Emote) -> Result<(), anyhow::Error> {
        let emote = am::Emote::from(&emote);

        self.emotes.retain(|e| e.name != emote.name);
        self.emotes.push(emote.clone());

        for m in self.members.values() {
            send(&m.tx, "emote", &emote).map_err(|err| error!("{err:?}")).ok();
        }

        Ok(())
    }

    /// Delete emote
    pub fn delete_emote(&mut self, emote_id: i32) -> Result<(), anyhow::Error> {
        if let Some(index) = self.emotes.iter().position(|e| e.id == emote_id) {
            let emote = self.emotes.remove(index);

            for m in self.members.values() {
                send(&m.tx, "delete-emote", &emote.name)
                    .map_err(|err| error!("{err:?}"))
                    .ok();
            }
        }

        Ok(())
    }

    pub fn is_deserted(&self) -> bool {
        self.members.is_empty()
    }

    fn get_playback_state(&self) -> am::PlaybackState {
        let rate = self.playback_state.rate;

        let time = if self.playback_state.is_playing {
            let time_diff = ((Utc::now() - self.playback_state_timestamp).num_milliseconds() as f64 * rate) / 1000.;

            self.playback_state.time + time_diff
        } else {
            self.playback_state.time
        };

        am::PlaybackState {
            time,
            rate,
            is_playing: self.playback_state.is_playing,
        }
    }

    fn send_content(&self) -> Result<(), anyhow::Error> {
        if let Some(content) = self.content.as_ref() {
            for m in self.members.values() {
                send(&m.tx, "content", &content).map_err(|err| error!("{err:?}")).ok();
            }
        }

        Ok(())
    }

    fn send_emotes(&self, tx: &Tx) -> Result<(), anyhow::Error> {
        send(tx, "emotes", &self.emotes)?;

        Ok(())
    }
}
