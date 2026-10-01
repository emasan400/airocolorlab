import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';

const LINKS = [
  ['#inicio', 'Inicio'],
  ['#proceso', 'Proceso'],
  ['#coleccion', 'Productos'],
  ['#faq', 'FAQs'],
  ['#contacto', 'Contacto'],
];

export default function Nav() {
  const { items, openCart } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <nav className={`nav${scrolled || menuOpen ? ' scrolled' : ''}`} aria-label="Navegación principal">
      <div className="container nav-inner">
        <a href="#inicio" className="nav-brand" onClick={() => setMenuOpen(false)}>
          <span className="dot" aria-hidden="true" /> AIRO Color Lab
        </a>
        <ul className="nav-links">
          {LINKS.map(([href, label]) => (
            <li key={href}><a href={href}>{label}</a></li>
          ))}
        </ul>
        <div className="nav-actions">
          <button className="nav-cta" onClick={openCart}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            <span className="nav-cta-text">Mi Carrito</span>
            <span className="count" aria-label={`${items.length} productos`}>{items.length}</span>
          </button>
          <button
            className="nav-burger"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="nav-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
      <div id="nav-menu" className={`nav-menu${menuOpen ? ' open' : ''}`}>
        <ul>
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <a href={href} onClick={() => setMenuOpen(false)}>{label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
