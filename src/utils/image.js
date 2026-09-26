/**
 * Подготовка фотографий к сохранению: уменьшаем снимок до разумного
 * размера и перекодируем в JPEG, чтобы данные поместились в localStorage.
 */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_SOURCE_FILE_SIZE = 15 * 1024 * 1024; // 15 МБ исходник

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Файл не похож на изображение'));
    img.src = src;
  });
}

export async function compressImage(file, { maxSide = 1280, quality = 0.78 } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error(`«${file?.name || 'файл'}» — не изображение. Подойдут JPG, PNG или WebP.`);
  }
  if (file.size > MAX_SOURCE_FILE_SIZE) {
    throw new Error(`«${file.name}» больше 15 МБ. Выберите снимок поменьше.`);
  }

  const original = await readAsDataURL(file);
  const img = await loadImage(original);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const compressed = canvas.toDataURL('image/jpeg', quality);
  // Если сжатие ничего не дало (например, маленький PNG), берём исходник
  return compressed.length < original.length ? compressed : original;
}

/** Приблизительный вес data URL в килобайтах. */
export const dataUrlSizeKb = (dataUrl) => Math.round((dataUrl.length * 3) / 4 / 1024);
