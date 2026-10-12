import { useEffect, useMemo, useState } from 'react';
import { CartProvider } from '../context/CartContext';
import Nav from './Nav';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import CookieConsent from './CookieConsent';
import QuickView from './QuickView';
import NotFound from './NotFound';
import { getTodosProductos, loadCatalogo } from '../lib/catalog';
import { productPath } from '../lib/slug';
import { openWhatsApp } from '../lib/secure';

function ProductView({ producto, relacionados }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [quickOpen, setQuickOpen] = useState(false);
  const imgs = producto.galeria?.length ? producto.galeria : producto.imagen_principal ? [producto.imagen_principal] : [];

  useEffect(() => {
    document.title = `${producto.nombre} — AIRO Color Lab`;
  }, [producto]);

  return (
    <main id="main-content" tabIndex={-1}>
      <section className="section product-page">
        <div className="container">
          <nav className="crumbs" aria-label="Ruta de navegación">
            <a href="/">Inicio</a><span aria-hidden="true">/</span><a href="/#coleccion">Productos</a><span aria-hidden="true">/</span><b>{producto.nombre}</b>
          </nav>
          <div className="product-page-grid">
            <div>
              <div className="modal-imgbox product-page-hero">
                {producto.badge && <span className="img-badge">{producto.badge}</span>}
                {imgs.length > 0 && <img src={imgs[imgIndex]} alt={producto.nombre} />}
              </div>
              {imgs.length > 1 && (
                <div className="thumbs" role="group" aria-label="Galería de imágenes">
                  {imgs.map((img, i) => (
                    <button key={i} type="button" className={`thumb${i === imgIndex ? ' active' : ''}`}
                      onClick={() => setImgIndex(i)} aria-label={`Imagen ${i + 1} de ${imgs.length}`} aria-pressed={i === imgIndex}>
                      <img src={img} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="section-eyebrow">{producto.categoria}</div>
              <h1 className="display product-title">{producto.nombre}</h1>
              <p className="product-lead">{producto.descripcion}</p>
              {producto.especificaciones?.length > 0 && (
                <div className="specs-box">
                  {producto.especificaciones.map((s, i) => <div className="spec-item" key={i}>{s}</div>)}
                </div>
              )}
              {producto.colores?.length > 0 && (
                <div>
                  <span className="field-label">Opciones / Variantes</span>
                  <div className="chips">
                    {producto.colores.map((c) => <span key={c} className="chip">{c}</span>)}
                  </div>
                </div>
              )}
              <p className="q-min-note">
                Pedido mínimo 10 unidades · múltiplos de 10 · precios por cotización a medida.
              </p>
              <div className="product-actions">
                <button className="btn btn--primary" onClick={() => setQuickOpen(true)}>
                  Personalizar y cotizar
                </button>
                <button className="btn btn--ghost" onClick={() => openWhatsApp(`¡Hola AIRO! Quiero consultar por *${producto.nombre}*.`)}>
                  Consultar por WhatsApp
                </button>
              </div>
            </div>
          </div>

          {relacionados.length > 0 && (
            <section className="related" aria-labelledby="related-title">
              <div className="section-eyebrow">Relacionados</div>
              <h2 id="related-title" className="display section-title">También te puede servir</h2>
              <div className="product-grid related-grid">
                {relacionados.map((r) => (
                  <a key={r.id_producto} className="product-card product-card--link" href={productPath(r)}>
                    <div className="product-img">
                      {r.imagen_principal ? <img src={r.imagen_principal} alt={r.nombre} loading="lazy" /> : <div className="product-img-empty" />}
                      <span className="product-cta">Ver producto →</span>
                    </div>
                    <div className="product-info">
                      <span className="row-cat">{r.categoria}</span>
                      <h3 className="product-name">{r.nombre}</h3>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
      <QuickView producto={quickOpen ? producto : null} onClose={() => setQuickOpen(false)} />
    </main>
  );
}

export default function ProductPage({ id }) {
  const [productos, setProductos] = useState(getTodosProductos);
  useEffect(() => {
    let alive = true;
    loadCatalogo().then((list) => { if (alive) setProductos(list); });
    return () => { alive = false; };
  }, []);

  const producto = useMemo(
    () => productos.find((p) => p.id_producto === id && p.activo),
    [productos, id]
  );
  const relacionados = useMemo(
    () => {
      const otros = productos.filter((p) => p.activo && p.id_producto !== id);
      const misma = otros.filter((p) => p.categoria === producto?.categoria);
      const resto = otros.filter((p) => p.categoria !== producto?.categoria);
      return [...misma, ...resto].slice(0, 3);
    },
    [productos, id, producto]
  );

  if (!producto) return <NotFound />;
  return (
    <CartProvider>
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
      <Nav />
      <ProductView producto={producto} relacionados={relacionados} />
      <Footer />
      <CartDrawer />
      <CookieConsent />
    </CartProvider>
  );
}
