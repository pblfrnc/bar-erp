// Reduz a foto do produto antes de enviar: foto de celular (3–8 MB) vira um JPEG de ~100 KB,
// o que basta para o cardápio e não pesa o banco nem o backup.
const MAX_SIDE = 1000;
const QUALITY = 0.82;

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // from-image respeita a rotação EXIF das fotos de celular
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // formato que o createImageBitmap não abre: tenta pelo <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function resizeImageFile(file: Blob): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await loadBitmap(file);
  } catch {
    throw new Error('Não foi possível abrir a imagem. Use uma foto JPEG, PNG ou WebP.');
  }
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');
  // PNG com fundo transparente ficaria preto no JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('Não foi possível processar a imagem.');
  return blob;
}
