//! Dependency-free image output: an 8-bit RGB PNG writer (zlib "stored"
//! deflate blocks, real CRC-32 / Adler-32) plus a 32-bit float PFM writer for
//! the untonemapped HDR frame.

use std::fs::File;
use std::io::{BufWriter, Result, Write};
use std::path::Path;

fn crc_table() -> [u32; 256] {
    let mut t = [0u32; 256];
    for (n, e) in t.iter_mut().enumerate() {
        let mut c = n as u32;
        for _ in 0..8 {
            c = if c & 1 != 0 { 0xEDB8_8320 ^ (c >> 1) } else { c >> 1 };
        }
        *e = c;
    }
    t
}

fn crc32(data: &[u8]) -> u32 {
    let t = crc_table();
    let mut c = 0xFFFF_FFFFu32;
    for b in data {
        c = t[((c ^ *b as u32) & 0xFF) as usize] ^ (c >> 8);
    }
    c ^ 0xFFFF_FFFF
}

fn adler32(data: &[u8]) -> u32 {
    let mut a = 1u32;
    let mut b = 0u32;
    for byte in data {
        a = (a + *byte as u32) % 65521;
        b = (b + a) % 65521;
    }
    (b << 16) | a
}

fn chunk<W: Write>(w: &mut W, kind: &[u8; 4], payload: &[u8]) -> Result<()> {
    w.write_all(&(payload.len() as u32).to_be_bytes())?;
    let mut crc_src = Vec::with_capacity(4 + payload.len());
    crc_src.extend_from_slice(kind);
    crc_src.extend_from_slice(payload);
    w.write_all(kind)?;
    w.write_all(payload)?;
    w.write_all(&crc32(&crc_src).to_be_bytes())?;
    Ok(())
}

/// Write an 8-bit RGB PNG. `rgb` must be `w * h * 3` bytes.
pub fn write_rgb8(path: &Path, w: u32, h: u32, rgb: &[u8]) -> Result<()> {
    assert_eq!(rgb.len(), (w as usize) * (h as usize) * 3);
    if let Some(dir) = path.parent() {
        if !dir.as_os_str().is_empty() {
            std::fs::create_dir_all(dir)?;
        }
    }
    let mut f = BufWriter::new(File::create(path)?);
    f.write_all(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A])?;

    let mut ihdr = Vec::with_capacity(13);
    ihdr.extend_from_slice(&w.to_be_bytes());
    ihdr.extend_from_slice(&h.to_be_bytes());
    ihdr.extend_from_slice(&[8, 2, 0, 0, 0]); // 8 bit, truecolour, deflate, no filter, no interlace
    chunk(&mut f, b"IHDR", &ihdr)?;

    // raw stream: one filter byte (0 = None) per scanline
    let stride = (w as usize) * 3;
    let mut raw = Vec::with_capacity((stride + 1) * h as usize);
    for y in 0..h as usize {
        raw.push(0u8);
        raw.extend_from_slice(&rgb[y * stride..(y + 1) * stride]);
    }

    // zlib container with uncompressed deflate blocks
    let mut z = Vec::with_capacity(raw.len() + raw.len() / 65535 * 5 + 64);
    z.extend_from_slice(&[0x78, 0x01]);
    let mut off = 0usize;
    while off < raw.len() {
        let n = (raw.len() - off).min(65535);
        let last = if off + n >= raw.len() { 1u8 } else { 0u8 };
        z.push(last);
        z.extend_from_slice(&(n as u16).to_le_bytes());
        z.extend_from_slice(&(!(n as u16)).to_le_bytes());
        z.extend_from_slice(&raw[off..off + n]);
        off += n;
    }
    z.extend_from_slice(&adler32(&raw).to_be_bytes());
    chunk(&mut f, b"IDAT", &z)?;
    chunk(&mut f, b"IEND", &[])?;
    f.flush()
}

/// Write a little-endian 32-bit float PFM (top-down rows are flipped to the
/// bottom-up convention PFM expects).
pub fn write_pfm(path: &Path, w: u32, h: u32, rgb: &[f32]) -> Result<()> {
    assert_eq!(rgb.len(), (w as usize) * (h as usize) * 3);
    if let Some(dir) = path.parent() {
        if !dir.as_os_str().is_empty() {
            std::fs::create_dir_all(dir)?;
        }
    }
    let mut f = BufWriter::new(File::create(path)?);
    write!(f, "PF\n{} {}\n-1.0\n", w, h)?;
    let stride = (w as usize) * 3;
    for y in (0..h as usize).rev() {
        let row = &rgb[y * stride..(y + 1) * stride];
        let mut bytes = Vec::with_capacity(stride * 4);
        for v in row {
            bytes.extend_from_slice(&v.to_le_bytes());
        }
        f.write_all(&bytes)?;
    }
    f.flush()
}

/// Read back a PFM written by [`write_pfm`] (used by `--regrade`).
pub fn read_pfm(path: &Path) -> Result<(u32, u32, Vec<f32>)> {
    fn token(data: &[u8], pos: &mut usize) -> String {
        // skip whitespace / comments
        while *pos < data.len() {
            let c = data[*pos];
            if c == b'#' {
                while *pos < data.len() && data[*pos] != b'\n' {
                    *pos += 1;
                }
            } else if c.is_ascii_whitespace() {
                *pos += 1;
            } else {
                break;
            }
        }
        let start = *pos;
        while *pos < data.len() && !data[*pos].is_ascii_whitespace() {
            *pos += 1;
        }
        let s = String::from_utf8_lossy(&data[start..*pos]).into_owned();
        *pos += 1; // consume the single separating whitespace byte
        s
    }

    let data = std::fs::read(path)?;
    let mut pos = 0usize;
    let magic = token(&data, &mut pos);
    let w: u32 = token(&data, &mut pos).parse().unwrap_or(0);
    let h: u32 = token(&data, &mut pos).parse().unwrap_or(0);
    let scale: f32 = token(&data, &mut pos).parse().unwrap_or(-1.0);
    if magic != "PF" || w == 0 || h == 0 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "not a 3-channel PFM file",
        ));
    }
    let need = (w as usize) * (h as usize) * 3;
    let body = &data[pos..];
    if body.len() < need * 4 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "truncated PFM body",
        ));
    }
    let mut flipped = vec![0f32; need];
    for i in 0..need {
        let b = [
            body[i * 4],
            body[i * 4 + 1],
            body[i * 4 + 2],
            body[i * 4 + 3],
        ];
        flipped[i] = if scale < 0.0 {
            f32::from_le_bytes(b)
        } else {
            f32::from_be_bytes(b)
        };
    }
    // PFM rows are bottom-up
    let stride = (w as usize) * 3;
    let mut out = vec![0f32; need];
    for y in 0..h as usize {
        let src = (h as usize - 1 - y) * stride;
        out[y * stride..(y + 1) * stride].copy_from_slice(&flipped[src..src + stride]);
    }
    Ok((w, h, out))
}
