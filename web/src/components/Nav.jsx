import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';

export default function Nav() {
  const { items, openCart } = useCart();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      <div className="container nav-inner">
        <a href="#inicio" className="nav-brand">
          <span className="dot" /> AIRO Color Lab
        </a>
        <ul className="nav-links">
          <li><a href="#inicio">Inicio</a></li>
          <li><a href="#proceso">Proceso</a></li>
          <li><a href="#coleccion">Colección</a></li>
          <li><a href="#faq">FAQs</a></li>
          <li><a href="#contacto">Contacto</a></li>
        </ul>
        <button className="nav-cta" onClick={openCart}>
          <svg viewBox="0 0 24 24"><path d="M2 3h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
          Mi Brief
          <span className="count">{items.length}</span>
        </button>
      </div>
    </nav>
  );
}
