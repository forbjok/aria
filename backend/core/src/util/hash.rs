use std::path::Path;

use anyhow::Context;
use tokio::{fs, io::AsyncReadExt};

const BUFFER_SIZE: usize = 65536;

pub async fn hash_blake3(path: &Path) -> Result<String, anyhow::Error> {
    let mut file = fs::File::open(path)
        .await
        .with_context(|| format!("Opening file for hashing: {}", path.display()))?;

    let mut hasher = blake3::Hasher::new();

    let mut buf = [0u8; BUFFER_SIZE];

    loop {
        let bytes = file.read(&mut buf).await?;
        if bytes == 0 {
            break;
        }

        hasher.update(&buf[..bytes]);
    }

    let hash = hasher.finalize();

    Ok(hash.to_hex().to_string())
}
