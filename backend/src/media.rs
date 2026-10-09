//! Обработка фотографий. Принимается только настоящее изображение (проверка сигнатуры),
//! оно полностью декодируется и заново кодируется в JPEG: так исчезают EXIF/GPS,
//! встроенные скрипты и «полиглот»-файлы, а размер ограничивается.
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{imageops::FilterType, DynamicImage, ImageFormat, ImageReader, Limits, RgbImage};
use sha2::{Digest, Sha256};
use std::io::Cursor;

use crate::error::{AppError, AppResult};

pub const MAX_PHOTOS: usize = 5;
const MAX_INPUT_BYTES: usize = 6 * 1024 * 1024;
const MAX_EDGE: u32 = 1600;
const JPEG_QUALITY: u8 = 82;

pub struct ProcessedPhoto {
    pub bytes: Vec<u8>,
    pub content_type: &'static str,
    pub sha256: String,
}

fn sniff(bytes: &[u8]) -> Option<ImageFormat> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) { Some(ImageFormat::Jpeg) }
    else if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) { Some(ImageFormat::Png) }
    else if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" { Some(ImageFormat::WebP) }
    else { None }
}

/// data URL (`data:image/jpeg;base64,...`) → сырые байты.
pub fn decode_data_url(s: &str) -> AppResult<Vec<u8>> {
    let rest = s.strip_prefix("data:image/").ok_or_else(|| AppError::validation("Фото должно быть передано как data URL изображения"))?;
    let (meta, payload) = rest.split_once(',').ok_or_else(|| AppError::validation("Повреждённый data URL фотографии"))?;
    if !meta.ends_with(";base64") {
        return Err(AppError::validation("Фото должно быть закодировано в base64"));
    }
    if payload.len() > MAX_INPUT_BYTES * 4 / 3 + 8 {
        return Err(AppError::validation("Фотография слишком большая (максимум 6 МБ)"));
    }
    STANDARD.decode(payload.trim()).map_err(|_| AppError::validation("Не удалось прочитать фотографию (base64)"))
}

/// Проверяет, декодирует и перекодирует изображение. Тяжёлая операция — вызывать через spawn_blocking.
pub fn process(raw: &[u8]) -> AppResult<ProcessedPhoto> {
    if raw.len() > MAX_INPUT_BYTES {
        return Err(AppError::validation("Фотография слишком большая (максимум 6 МБ)"));
    }
    let format = sniff(raw).ok_or_else(|| AppError::validation("Допустимы только изображения JPEG, PNG или WebP"))?;
    let mut reader = ImageReader::with_format(Cursor::new(raw), format);
    let mut limits = Limits::default();
    limits.max_image_width = Some(8000);
    limits.max_image_height = Some(8000);
    limits.max_alloc = Some(256 * 1024 * 1024);
    reader.limits(limits);
    let img = reader.decode().map_err(|_| AppError::validation("Файл не является корректным изображением"))?;
    encode_jpeg(img)
}

fn encode_jpeg(img: DynamicImage) -> AppResult<ProcessedPhoto> {
    let img = if img.width() > MAX_EDGE || img.height() > MAX_EDGE { img.resize(MAX_EDGE, MAX_EDGE, FilterType::Lanczos3) } else { img };
    // JPEG без альфа-канала: прозрачность заливаем белым
    let rgba = img.to_rgba8();
    let mut rgb = RgbImage::new(rgba.width(), rgba.height());
    for (x, y, p) in rgba.enumerate_pixels() {
        let a = p[3] as u32;
        let blend = |c: u8| (((c as u32) * a + 255 * (255 - a)) / 255) as u8;
        rgb.put_pixel(x, y, image::Rgb([blend(p[0]), blend(p[1]), blend(p[2])]));
    }
    let mut out = Vec::new();
    let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, JPEG_QUALITY);
    rgb.write_with_encoder(enc).map_err(|e| AppError::Internal(anyhow::anyhow!("jpeg: {e}")))?;
    let sha256 = hex::encode(Sha256::digest(&out));
    Ok(ProcessedPhoto { bytes: out, content_type: "image/jpeg", sha256 })
}

/// Обрабатывает набор data URL в отдельном потоке.
pub async fn process_many(data_urls: Vec<String>) -> AppResult<Vec<ProcessedPhoto>> {
    if data_urls.len() > MAX_PHOTOS {
        return Err(AppError::validation(format!("Можно прикрепить не более {MAX_PHOTOS} фотографий")));
    }
    tokio::task::spawn_blocking(move || {
        data_urls.iter().map(|u| decode_data_url(u).and_then(|raw| process(&raw))).collect::<AppResult<Vec<_>>>()
    })
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("join: {e}")))?
}

/// Градиентная заглушка для демонстрационных данных (без внешних скачиваний).
pub fn placeholder(seed: u8) -> Vec<u8> {
    let img = RgbImage::from_fn(640, 420, |x, y| {
        let r = (40 + (x * 150 / 640)) as u8;
        let g = (60 + (y * 120 / 420)) as u8;
        let b = 110u8.wrapping_add(seed.wrapping_mul(37));
        image::Rgb([r, g, b])
    });
    encode_jpeg(DynamicImage::ImageRgb8(img)).map(|p| p.bytes).unwrap_or_default()
}
