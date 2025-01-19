use std::{io::Read, path::Path};

use anyhow::Context;
use bytes::{Buf, Bytes};
use futures_core::Stream;
use futures_util::StreamExt;
use tokio::{
    fs,
    io::{AsyncReadExt, AsyncWriteExt},
};

const BUFFER_SIZE: usize = 65536;

#[allow(dead_code)]
pub struct HashResult {
    pub hash: String,
    pub size: usize,
}

/// Calculate blake3 hash of a file
pub async fn hash_blake3_file(path: &Path) -> Result<HashResult, anyhow::Error> {
    let mut file = fs::File::open(path)
        .await
        .with_context(|| format!("Opening file for hashing: {}", path.display()))?;

    let mut hasher = blake3::Hasher::new();

    let mut buf = [0u8; BUFFER_SIZE];

    let mut total_size = 0;
    loop {
        let bytes = file.read(&mut buf).await?;
        if bytes == 0 {
            break;
        }

        total_size += bytes;

        hasher.update(&buf[..bytes]);
    }

    let hash = hasher.finalize();

    Ok(HashResult {
        hash: hash.to_hex().to_string(),
        size: total_size,
    })
}

/// Read bytes from stream, calculate hash and write to a file
pub async fn hash_blake3_to_file_from_stream<S: Stream<Item = Result<Bytes, E>> + Unpin, E>(
    stream: &mut S,
    path: &Path,
) -> Result<HashResult, anyhow::Error> {
    let mut file = fs::File::create(path)
        .await
        .with_context(|| format!("Opening file for writing: {}", path.display()))?;

    let mut hasher = blake3::Hasher::new();

    let mut buf = [0u8; BUFFER_SIZE];

    let mut total_size = 0;
    while let Some(Ok(bytes)) = stream.next().await {
        let mut reader = bytes.reader();

        loop {
            let bytes = reader.read(&mut buf)?;
            if bytes == 0 {
                break;
            }

            total_size += bytes;

            let buf = &buf[..bytes];
            hasher.update(buf);
            file.write_all(buf).await?;
        }
    }

    let hash = hasher.finalize();

    Ok(HashResult {
        hash: hash.to_hex().to_string(),
        size: total_size,
    })
}
