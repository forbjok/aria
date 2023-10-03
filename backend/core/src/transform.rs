use aria_models::local as lm;
use aria_store::models as dbm;

pub fn dbm_room_to_lm(r: &dbm::Room) -> lm::Room {
    lm::Room {
        id: r.id.unwrap(),
        name: r.name.as_ref().cloned().unwrap(),
        content: r
            .content
            .as_ref()
            .and_then(|c| serde_json::from_str(c).unwrap_or_default()),
        playback_state: r
            .playback_state
            .as_ref()
            .and_then(|ps| serde_json::from_str(ps).unwrap_or_default()),
    }
}

pub fn dbm_post_to_lm(p: dbm::PostAndImage) -> lm::Post {
    lm::Post {
        id: p.post.id.unwrap(),
        name: p.post.name,
        comment: p.post.comment,
        image: p.image.map(|i| lm::PostImage {
            filename: i.filename.unwrap(),
            hash: i.hash.unwrap(),
            ext: i.ext.unwrap(),
            tn_ext: i.tn_ext.unwrap(),
        }),
        posted_at: p.post.created_at.unwrap(),
        user_id: p.post.user_id.unwrap(),
        admin: p.post.admin,
    }
}

pub fn dbm_emote_to_lm(e: dbm::Emote) -> lm::Emote {
    lm::Emote {
        id: e.id.unwrap(),
        name: e.name.unwrap(),
        hash: e.hash.unwrap(),
        ext: e.ext.unwrap(),
    }
}
