// Render compartido del mockup referencial: imagen de fondo + logo con la
// MISMA geometría que drawMockup/export (logo 25% del ancho * scale,
// x/y en % del contenido de la imagen — sin letterboxing porque la imagen
// va a width 100% / height auto y el stage la envuelve ajustado).
import { useEffect, useState } from 'react';
import { getTintedBackground, LOGO_BASE_RATIO } from '../lib/mockup';

export default function MockupPreview({ background, logo, x = 50, y = 50, scale = 1, rotation = 0, tint = null, alt = '', logoProps = {}, className = '' }) {
  const [bgSrc, setBgSrc] = useState(background);
  useEffect(() => {
    let alive = true;
    setBgSrc(background);
    getTintedBackground(background, tint)
      .then((src) => {
        if (alive) setBgSrc(src);
      })
      .catch(() => {
        if (alive) setBgSrc(background);
      });
    return () => { alive = false; };
  }, [background, tint]);

  return (
    <div className={`mockup-stage${className ? ` ${className}` : ''}`}>
      {background && <img className="mockup-bg" src={bgSrc} alt={alt} draggable={false} />}
      {logo && (
        <img
          className="mockup-logo"
          src={logo}
          alt="Tu logo (referencial)"
          draggable={false}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${LOGO_BASE_RATIO * 100}%`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
          }}
          {...logoProps}
        />
      )}
    </div>
  );
}
