// Geometría UNICA del mockup referencial — la misma en QuickView (CSS),
// en el thumbnail del drawer y en la exportación PNG.
// El logo ocupa 25% del ancho de la imagen * scale; x/y son % del contenido
// de la imagen (el fondo se muestra sin letterboxing: imagen a ancho completo).

export const LOGO_BASE_RATIO = 0.25;

// Dibuja fondo + logo con la misma transformación que la UI.
// Canvas = tamaño natural de la imagen de fondo.
export function drawMockup(canvas, bgImg, logoImg, { x, y, scale, rotation }) {
  canvas.width = bgImg.naturalWidth;
  canvas.height = bgImg.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bgImg, 0, 0);
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
export async function exportMockupPng({ background, logo_data_url, x, y, scale, rotation }, filename) {
  const bgImg = await loadImg(background);
  const logoImg = logo_data_url ? await loadImg(logo_data_url) : null;
  const canvas = document.createElement('canvas');
  drawMockup(canvas, bgImg, logoImg, { x, y, scale, rotation });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}
