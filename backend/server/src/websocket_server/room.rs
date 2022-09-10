use std::borrow::Cow;
use std::collections::HashMap;

use anyhow::Context;
use chrono::{DateTime, Utc};
use tracing::error;

use aria_core::AriaCore;
use aria_models::api as am;
use aria_models::local as lm;

use super::{send, ConnectionId, Tx};

struct Member {
    id: ConnectionId,
    tx: Tx,
}

struct PreparedEmote {
    name: String,
    html: String,
}

pub(super) struct Room {
    members: Vec<Member>,
    posts: Vec<am::Post>,
    emotes: HashMap<String, PreparedEmote>,
    master: ConnectionId,
    content: Option<am::Content>,
    playback_state_timestamp: DateTime<Utc>,
    playback_state: am::PlaybackState,
}

impl From<&lm::Emote> for PreparedEmote {
    fn from(e: &lm::Emote) -> Self {
        let name = e.name.clone();
        let html = format!(r#"<img class="emote" src="/f/e/{}.{}" title="!{name}">"#, e.hash, e.ext);

        Self { name, html }
    }
}

impl Room {
    pub async fn load(name: &str, core: &AriaCore) -> Result<Self, anyhow::Error> {
        let room = core
            .get_room(name)
            .await
            .context("Getting room")?
            .with_context(|| format!("Room not found: {name}"))?;

        let emotes = core.get_emotes(name).await.context("Error getting emotes")?;

        let recent_posts = core
            .get_recent_posts(name)
            .await
            .context("Error getting recent posts")?;

        // Prepare emotes
        let emotes = emotes
            .into_iter()
            .map(|e| {
                let emote = PreparedEmote::from(&e);

                (e.name, emote)
            })
            .collect();

        Ok(Self {
            members: Vec::new(),
            posts: recent_posts.iter().map(|p| process_post(p, &emotes)).collect(),
            emotes,
            master: 0,
            content: room.content,
            playback_state_timestamp: Utc::now(),
            playback_state: am::PlaybackState::default(),
        })
    }

    pub fn join(&mut self, id: ConnectionId, tx: Tx) -> Result<(), anyhow::Error> {
        let member = Member { id, tx: tx.clone() };
        self.members.push(member);

        send(&tx, "content", &self.content)?;
        self.send_recent_posts(&tx)?;
        send(&tx, "joined", ())?;

        Ok(())
    }

    pub fn leave(&mut self, id: ConnectionId) -> Result<(), anyhow::Error> {
        self.members.retain(|m| m.id != id);
        Ok(())
    }

    pub fn send_recent_posts(&self, tx: &Tx) -> Result<(), anyhow::Error> {
        let posts_len = self.posts.len();

        let posts = &self.posts[posts_len - 50.min(posts_len)..];

        send(tx, "oldposts", posts)?;

        Ok(())
    }

    pub fn post(&mut self, post: &lm::Post) -> Result<(), anyhow::Error> {
        let post = process_post(post, &self.emotes);

        self.posts.push(post.clone());

        for m in self.members.iter() {
            send(&m.tx, "post", &post).map_err(|err| error!("{err:?}")).ok();
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
        let time_diff = ((Utc::now() - self.playback_state_timestamp).num_milliseconds() as f64 * rate) / 1000.;
        let time = self.playback_state.time + time_diff;

        am::PlaybackState {
            time,
            rate,
            is_playing: self.playback_state.is_playing,
        }
    }

    /// Add or update emote
    pub fn add_emote(&mut self, emote: &lm::Emote) -> Result<(), anyhow::Error> {
        let emote = PreparedEmote::from(emote);

        self.emotes.insert(emote.name.clone(), emote);

        Ok(())
    }
}

fn replace_emotes<'a>(comment: &'a str, emotes: &HashMap<String, PreparedEmote>) -> Cow<'a, str> {
    let re = regex::Regex::new(r#"!([^\s!]+)"#).unwrap();

    re.replace_all(comment, |caps: &regex::Captures| {
        let name = caps.get(1).unwrap().as_str();

        // If an emote with that name is found, replace it with the emote html...
        if let Some(emote) = emotes.get(name) {
            Cow::Owned(emote.html.clone())
        } else {
            // ... otherwise, just leave it as it is.
            Cow::Owned(caps.get(0).unwrap().as_str().to_owned())
        }
    })
}

fn process_post(post: &lm::Post, emotes: &HashMap<String, PreparedEmote>) -> am::Post {
    let mut post = am::Post::from(post);
    post.comment = post.comment.map(|c| replace_emotes(&c, emotes).into_owned());

    post
}
