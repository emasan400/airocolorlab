// Render compartido del mockup referencial: imagen de fondo + logo con la
// MISMA geometría que drawMockup/export (logo 25% del ancho * scale,
// x/y en % del contenido de la imagen — sin letterboxing porque la imagen
// va a width 100% / height auto y el stage la envuelve ajustado).
import { LOGO_BASE_RATIO } from '../lib/mockup';

export default function MockupPreview({ background, logo, x = 50, y = 50, scale = 1, rotation = 0, alt = '', logoProps = {}, className = '' }) {
  return (
    <div className={`mockup-stage${className ? ` ${className}` : ''}`}>
      {background && <img className="mockup-bg" src={background} alt={alt} draggable={false} />}
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
