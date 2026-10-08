import { useEffect, useState } from 'react';
import { getProductos, loadCatalogo } from '../lib/catalog';
import { useCart } from '../context/CartContext';
import { Reveal } from '../hooks/useReveal';
import QuickView from './QuickView';
import { productPath } from '../lib/slug';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'indumentaria', label: 'Indumentaria' },
  { id: 'merchandising', label: 'Merchandising' },
  { id: 'packs', label: 'Packs' },
];

export default function Catalog() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [productos, setProductos] = useState(getProductos);
  const [selected, setSelected] = useState(null);
  const { openCart, items } = useCart();

  // Primer pintado con el JSON local (o borrador del admin) y luego
  // se reemplaza con datos vivos de Postgres cuando responde Supabase.
  useEffect(() => {
    let alive = true;
    loadCatalogo().then((list) => {
      if (alive) setProductos(list.filter((p) => p.activo));
    });
    return () => { alive = false; };
  }, []);

  // Las tarjetas lifestyle cambian el filtro del catálogo
  useEffect(() => {
    const onFilter = (e) => setFilter(e.detail);
    window.addEventListener('airo:catalog-filter', onFilter);
    return () => window.removeEventListener('airo:catalog-filter', onFilter);
  }, []);

  const filtered = productos.filter((p) => {
    const matchFilter = filter === 'all' || p.categoria === filter;
    const text = `${p.nombre} ${p.descripcion} ${p.badge || ''}`.toLowerCase();
    return matchFilter && text.includes(query.toLowerCase());
  });

  return (
    <section className="section" id="coleccion">
      <div className="container ed-split">
        <Reveal className="ed-sticky">
          <span className="ed-index">03</span>
          <div className="section-eyebrow">Catálogo</div>
          <h2 className="display section-title">Nuestros productos.</h2>
          <p className="section-sub">
            Producción a pedido · mínimo 10 unidades · cotización a medida.
            Seleccioná productos para armar tu cotización.
          </p>
          <div style={{ marginTop: 32 }}>
            <button className="btn btn--primary" onClick={openCart}>
              Ver mi cotización ({items.length})
            </button>
          </div>
        </Reveal>

        <div>
          <Reveal className="toolbar" style={{ marginBottom: 32 }}>
            <div className="filters" role="group" aria-label="Filtrar por categoría">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`filter-btn${filter === f.id ? ' active' : ''}`}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="search-box">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
              <label htmlFor="catalog-search" className="sr-only">Buscar productos</label>
              <input
                id="catalog-search"
                type="search"
                placeholder="Buscar productos..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </Reveal>

          <div className="product-grid">
            {filtered.length === 0 && (
              <p className="index-empty">No se encontraron productos que coincidan con tu búsqueda.</p>
            )}
            {filtered.map((p, i) => (
              <Reveal
                key={p.id_producto}
                delay={(i % 3) * 80}
                className="product-card"
                as="article"
                aria-label={`Ver detalle de ${p.nombre}`}
              >
                <a className="product-img" href={productPath(p)} aria-label={`Página de ${p.nombre}`}>
                  {p.imagen_principal ? (
                    <img src={p.imagen_principal} alt={p.nombre} loading="lazy" />
                  ) : (
                    <div className="product-img-empty" />
                  )}
                  {p.badge && <span className="img-badge">{p.badge}</span>}
                  <span className="product-cta">Ver producto →</span>
                </a>
                <div className="product-info">
                  <span className="row-cat">{p.categoria}</span>
                  <h3 className="product-name">
                    <a href={productPath(p)}>{p.nombre}</a>
                  </h3>
                  <p className="product-desc">{p.descripcion}</p>
                  <button type="button" className="product-customize" onClick={() => setSelected(p)}>
                    Personalizar →
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <QuickView producto={selected} onClose={() => setSelected(null)} />

      <button className="floating-cart" onClick={openCart} aria-label="Abrir cotización">
        <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
        <span className="count">{items.length}</span>
      </button>
    </section>
  );
}
