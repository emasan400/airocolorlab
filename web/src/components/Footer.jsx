import { useEffect, useState } from 'react';
import { mail } from '../lib/secure';

// Anchors internos viven en home; en páginas de producto se prefijan '/'.
const P = (h) => (window.location.pathname === '/' ? h : `/${h}`);

export default function Footer() {
  const [email, setEmail] = useState('');
  useEffect(() => setEmail(mail()), []);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-xl">AIRO Color Lab<span className="dot">.</span></div>
        <div className="footer-grid">
          <div>
            <p>Estudio B2B de producción y personalización textil. Buenos Aires, Argentina.</p>
          </div>
          <div>
            <h5>Secciones</h5>
            <ul>
              <li><a href={P('#inicio')}>Inicio</a></li>
              <li><a href={P('#coleccion')}>Nuestros productos</a></li>
              <li><a href={P('#proceso')}>Proceso</a></li>
              <li><a href={P('#faq')}>FAQs</a></li>
            </ul>
          </div>
          <div>
            <h5>Contacto</h5>
            <ul>
              <li><a href={email ? `mailto:${email}` : '#'}>{email || '…'}</a></li>
              <li><a href="https://www.instagram.com/airocolorlab/" target="_blank" rel="noreferrer">Instagram</a></li>
              <li><a href={P('#contacto')}>Escribinos</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} AIRO Color Lab</span>
          <span className="footer-legal">
            <a href="#/privacidad">Política de Privacidad</a>
            <a href="#/terminos">Términos y Condiciones</a>
          </span>
          <span>Calidad de fábrica, desde 10 unidades.</span>
        </div>
      </div>
    </footer>
  );
}
