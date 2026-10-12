// Geometría UNICA del mockup referencial — la misma en QuickView (CSS),
// en el thumbnail del drawer y en la exportación PNG.
// El logo ocupa 25% del ancho de la imagen * scale; x/y son % del contenido
// de la imagen (el fondo se muestra sin letterboxing: imagen a ancho completo).

export const LOGO_BASE_RATIO = 0.25;
export const TINTS = [
  { id: 'blanco', label: 'Blanco', hex: '#FFFFFF' },
  { id: 'negro', label: 'Negro', hex: '#000000' },
  { id: 'gris', label: 'Gris', hex: '#808080' },
];
export const TINT_HEXES = TINTS.map((t) => t.hex);

const MASKS = new Set([
  '/imagenes/productos/remera.webp',
  '/imagenes/productos/buzo-capucha.webp',
  '/imagenes/productos/buzo-sin-capucha.webp',
  '/imagenes/productos/totes.webp',
]);
export const maskFor = (bg) => {
  const webp = MASKS.has(bg) ? bg : bg?.replace(/\.jpg$/i, '.webp');
  return MASKS.has(webp) ? webp.replace('/productos/', '/productos/mascaras/').replace(/\.webp$/, '.png') : null;
};
export const isTintable = (bg) => maskFor(bg) !== null;
const tintCache = new Map();

export function tintBackground(bgImg, maskImg, hex) {
  const canvas = document.createElement('canvas');
  canvas.width = bgImg.naturalWidth;
  canvas.height = bgImg.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bgImg, 0, 0);
  if (hex === '#FFFFFF') return canvas;

  const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
  const mask = maskCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  const tint = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);

  for (let i = 0; i < source.data.length; i += 4) {
    const alpha = mask[i + 3] / 255;
    if (alpha === 0) continue;
    const r = source.data[i];
    const g = source.data[i + 1];
    const b = source.data[i + 2];
    const lightness = Math.min(1, (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 / 0.96);
    const highlight = 0.16 * Math.max(0, (lightness - 0.7) / 0.3) ** 2;
    const original = [r, g, b];
    for (let channel = 0; channel < 3; channel++) {
      const color = tint[channel];
      const output = color * lightness + (1 - color) * highlight;
      source.data[i + channel] = Math.round(original[channel] * (1 - alpha) + output * 255 * alpha);
    }
  }
  ctx.putImageData(source, 0, 0);
  return canvas;
}

export function getTintedBackground(bg, hex) {
  if (!hex || hex === '#FFFFFF' || !isTintable(bg)) return Promise.resolve(bg);
  const key = `${bg}|${hex}`;
  if (!tintCache.has(key)) {
    const pending = Promise.all([loadImg(bg), loadImg(maskFor(bg))])
      .then(([bgImg, maskImg]) => tintBackground(bgImg, maskImg, hex).toDataURL('image/png'))
      .catch((error) => {
        tintCache.delete(key);
        throw error;
      });
    tintCache.set(key, pending);
  }
  return tintCache.get(key);
}

// Dibuja fondo + logo con la misma transformación que la UI.
// Canvas = tamaño natural de la imagen de fondo.
export function drawMockup(canvas, bgImg, logoImg, { x, y, scale, rotation, tint, maskImg }) {
  canvas.width = bgImg.naturalWidth;
  canvas.height = bgImg.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(tint && maskImg ? tintBackground(bgImg, maskImg, tint) : bgImg, 0, 0);
  if (logoImg) {
    const w = canvas.width * LOGO_BASE_RATIO * scale;
    const h = (logoImg.naturalHeight / logoImg.naturalWidth) * w;
    ctx.save();
    ctx.translate((x / 100) * canvas.width, (y / 100) * canvas.height);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(logoImg, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  return canvas;
}

// Carga una imagen (mismo origen o data URL — sin CORS de terceros).
export const loadImg = (src) =>
  new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

// Exporta el mockup como PNG referencial.
export async function exportMockupPng({ background, logo_data_url, x, y, scale, rotation, tint }, filename) {
  const bgImg = await loadImg(background);
  const logoImg = logo_data_url ? await loadImg(logo_data_url) : null;
  const maskImg = tint && tint !== '#FFFFFF' && isTintable(background)
    ? await loadImg(maskFor(background))
    : null;
  const canvas = document.createElement('canvas');
  drawMockup(canvas, bgImg, logoImg, { x, y, scale, rotation, tint, maskImg });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}
