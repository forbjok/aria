use std::collections::VecDeque;

use anyhow::Context;
use chrono::{DateTime, Utc};
use tracing::error;

use aria_core::AriaCore;
use aria_models::api as am;
use aria_models::local as lm;

use super::{send, ConnectionId, Tx};

const MAX_POSTS: usize = 50;

struct Member {
    id: ConnectionId,
    password: String,
    tx: Tx,
}

pub(super) struct Room {
    pub id: i32,
    members: Vec<Member>,
    posts: VecDeque<lm::Post>,
    emotes: Vec<am::Emote>,
    master: ConnectionId,
    content: Option<am::Content>,
    playback_state_timestamp: DateTime<Utc>,
    playback_state: am::PlaybackState,
}

impl Room {
    pub async fn load(room_id: i32, core: &AriaCore) -> Result<Self, anyhow::Error> {
        let room = core
            .get_room(room_id)
            .await
            .context("Getting room")?
            .with_context(|| format!("Room not found: {room_id}"))?;

        let emotes = core.get_emotes(room_id).await.context("Error getting emotes")?;

        let recent_posts = core
            .get_recent_posts(room_id, MAX_POSTS as i32)
            .await
            .context("Error getting recent posts")?;

        // Prepare emotes
        let emotes = emotes.iter().map(am::Emote::from).collect();

        Ok(Self {
            id: room_id,
            members: Vec::new(),
            posts: recent_posts.into_iter().collect(),
            emotes,
            master: 0,
            content: room.content,
            playback_state_timestamp: Utc::now(),
            playback_state: am::PlaybackState::default(),
        })
    }

    pub fn join(&mut self, id: ConnectionId, tx: Tx, password: &str) -> Result<(), anyhow::Error> {
        let member = Member {
            id,
            password: password.to_string(),
            tx: tx.clone(),
        };
        self.members.push(member);

        send(&tx, "content", &self.content)?;
        send(&tx, "playbackstate", &self.get_playback_state())?;

        self.send_emotes(&tx)?;
        self.send_recent_posts(&tx, password)?;
        send(&tx, "joined", ())?;

        Ok(())
    }

    pub fn leave(&mut self, id: ConnectionId) -> Result<(), anyhow::Error> {
        self.members.retain(|m| m.id != id);
        Ok(())
    }

    pub fn send_emotes(&self, tx: &Tx) -> Result<(), anyhow::Error> {
        send(tx, "emotes", &self.emotes)?;

        Ok(())
    }

    pub fn send_recent_posts(&self, tx: &Tx, password: &str) -> Result<(), anyhow::Error> {
        let posts: Vec<_> = self
            .posts
            .iter()
            .map(|p| {
                let mut post = am::Post::from(p);
                post.you = p.password.as_deref() == Some(password);

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
        let password = post.password.clone();

        self.posts.push_back(post);

        for m in self.members.iter() {
            post_am.you = password.as_ref().map(|pw| pw == &m.password).unwrap_or(false);

            send(&m.tx, "post", &post_am).map_err(|err| error!("{err:?}")).ok();
        }

        Ok(())
    }

    /// Delete post
    pub fn delete_post(&mut self, post_id: i64) -> Result<(), anyhow::Error> {
        self.posts.retain(|p| p.id != post_id);

        for m in self.members.iter() {
            send(&m.tx, "delete-post", post_id)
                .map_err(|err| error!("{err:?}"))
                .ok();
        }

        Ok(())
    }

    pub fn content(&mut self, content: &am::Content) -> Result<(), anyhow::Error> {
        self.content = Some(content.clone());

        for m in self.members.iter() {
            send(&m.tx, "content", content).map_err(|err| error!("{err:?}")).ok();
        }

        Ok(())
    }

    pub fn set_master(&mut self, id: ConnectionId) -> Result<(), anyhow::Error> {
        // If already master, return immediately.
        if self.master == id {
            return Ok(());
        }

        // Notify the previous master that it is no longer mater.
        if let Some(old_master) = self.members.iter().find(|m| m.id == self.master) {
            send(&old_master.tx, "not-master", ())?;
        }

        // Set new master
        self.master = id;

        Ok(())
    }

    pub fn relinquish_master(&mut self, id: ConnectionId) -> Result<(), anyhow::Error> {
        // If this id is not master, return immediately.
        if self.master != id {
            return Ok(());
        }

        // Clear master
        self.master = 0;

        Ok(())
    }

    pub fn set_playback_state(&mut self, id: ConnectionId, ps: &am::PlaybackState) -> Result<(), anyhow::Error> {
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

        for m in self.members.iter() {
            send(&m.tx, "playbackstate", &ps).map_err(|err| error!("{err:?}")).ok();
        }

        Ok(())
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

    /// Add or update emote
    pub fn add_emote(&mut self, emote: &lm::Emote) -> Result<(), anyhow::Error> {
        let emote = am::Emote::from(emote);

        self.emotes.retain(|e| e.name != emote.name);
        self.emotes.push(emote.clone());

        for m in self.members.iter() {
            send(&m.tx, "emote", &emote).map_err(|err| error!("{err:?}")).ok();
        }

        Ok(())
    }

    /// Delete emote
    pub fn delete_emote(&mut self, emote_id: i32) -> Result<(), anyhow::Error> {
        if let Some(index) = self.emotes.iter().position(|e| e.id == emote_id) {
            let emote = self.emotes.remove(index);

            for m in self.members.iter() {
                send(&m.tx, "delete-emote", &emote.name)
                    .map_err(|err| error!("{err:?}"))
                    .ok();
            }
        }

        Ok(())
    }
}
