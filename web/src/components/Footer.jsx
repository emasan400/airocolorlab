import { useEffect, useState } from 'react';
import { mail } from '../lib/secure';

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
              <li><a href="#inicio">Inicio</a></li>
              <li><a href="#coleccion">Colección</a></li>
              <li><a href="#proceso">Proceso</a></li>
              <li><a href="#contacto">Contacto</a></li>
            </ul>
          </div>
          <div>
            <h5>Contacto</h5>
            <ul>
              <li><a href={email ? `mailto:${email}` : '#'}>{email || '…'}</a></li>
              <li><a href="https://www.instagram.com/airocolorlab/" target="_blank" rel="noreferrer">Instagram</a></li>
              <li><a href="#/admin">Admin</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} AIRO Color Lab</span>
          <a href="#/privacidad">Política de Privacidad</a>
          <span>Calidad de fábrica, desde 10 unidades.</span>
        </div>
      </div>
    </footer>
  );
}
