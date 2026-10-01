export type StockPhotoError = 'format' | 'size' | 'decode';
export class InvalidStockPhoto extends Error {
  constructor(public readonly reason: StockPhotoError) { super(reason); }
}

/** Réencode la photo sans métadonnées ; stockage persistant borné à 256 Ko. */
export async function prepareStockPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new InvalidStockPhoto('format');
  if (file.size > 8 * 1024 * 1024) throw new InvalidStockPhoto('size');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40_000_000) throw new InvalidStockPhoto('size');
    const ratio = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new InvalidStockPhoto('decode');
    context.fillStyle = '#f4f6f8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.7, 0.5]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.startsWith('data:image/jpeg;base64,') && (result.length - 23) * 3 / 4 <= 256 * 1024) return result;
    }
    throw new InvalidStockPhoto('size');
  } catch (error) {
    throw error instanceof InvalidStockPhoto ? error : new InvalidStockPhoto('decode');
  } finally {
    URL.revokeObjectURL(url);
  }
}
