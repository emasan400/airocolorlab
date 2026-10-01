import { useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { openWhatsApp } from '../lib/secure';

const PROD_DATA = [
  ['Pedido mínimo', '10 unidades'],
  ['Producción', 'A pedido · sin stock fijo'],
  ['Personalización', 'Arte propio o asistido por el estudio'],
  ['Cotización', 'A medida según volumen y terminación'],
];

export default function QuickView({ producto, onClose }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  const [cantidad, setCantidadState] = useState(10);
  const [logo, setLogo] = useState(null);
  const [logoPos, setLogoPos] = useState({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const imgboxRef = useRef(null);
  const { addItem } = useCart();

  useEffect(() => {
    setImgIndex(0);
    setColorIdx(0);
    setCantidadState(10);
    setLogo(null);
    setLogoPos({ x: 50, y: 50 });
  }, [producto]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!producto) return <div className="modal-overlay" />;

  const imgs =
    producto.galeria?.length > 0
      ? producto.galeria
      : producto.imagen_principal
        ? [producto.imagen_principal]
        : [];

  const prev = () => setImgIndex((i) => (i - 1 + imgs.length) % imgs.length);
  const next = () => setImgIndex((i) => (i + 1) % imgs.length);

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Subí un archivo de imagen.');
    if (file.size > 3 * 1024 * 1024) return alert('El logo supera los 3 MB.');
    const rd = new FileReader();
    rd.onload = () => {
      setLogo(rd.result);
      setLogoPos({ x: 50, y: 50 });
    };
    rd.readAsDataURL(file);
    e.target.value = '';
  };

  const onLogoPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onLogoPointerMove = (e) => {
    if (!dragging || !imgboxRef.current) return;
    const r = imgboxRef.current.getBoundingClientRect();
    setLogoPos({
      x: Math.min(96, Math.max(4, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(96, Math.max(4, ((e.clientY - r.top) / r.height) * 100)),
    });
  };

  const onLogoPointerUp = () => setDragging(false);

  const handleAdd = () => {
    const color = producto.colores?.[colorIdx];
    const titulo = color ? `${producto.nombre} (${color})` : producto.nombre;
    addItem(producto.id_producto, titulo, cantidad);
    onClose();
  };

  const handleWhatsApp = () => {
    const color = producto.colores?.[colorIdx];
    openWhatsApp(
      `¡Hola AIRO! Quiero consultar por *${producto.nombre}*` +
        (color ? ` en variante ${color}` : '') +
        `.\nCantidad estimada: ${cantidad} unidades.`
    );
  };

  return (
    <div
      className={`modal-overlay${producto ? ' open' : ''}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={producto.nombre}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>

        <div className="modal-left">
          <div className="modal-imgbox" ref={imgboxRef}>
            {producto.badge && <span className="img-badge">{producto.badge}</span>}
            {imgs.length > 1 && (
              <>
                <button className="carousel-btn prev" onClick={prev} aria-label="Anterior">❮</button>
                <button className="carousel-btn next" onClick={next} aria-label="Siguiente">❯</button>
              </>
            )}
            {imgs.length > 0 && <img src={imgs[imgIndex]} alt={producto.nombre} />}
            {logo && (
              <img
                className={`logo-overlay${dragging ? ' dragging' : ''}`}
                src={logo}
                alt="Tu logo"
                draggable={false}
                style={{ left: `${logoPos.x}%`, top: `${logoPos.y}%` }}
                onPointerDown={onLogoPointerDown}
                onPointerMove={onLogoPointerMove}
                onPointerUp={onLogoPointerUp}
                onPointerCancel={onLogoPointerUp}
              />
            )}
          </div>
          {imgs.length > 1 && (
            <div className="thumbs">
              {imgs.map((img, i) => (
                <div
                  key={i}
                  className={`thumb${i === imgIndex ? ' active' : ''}`}
                  onClick={() => setImgIndex(i)}
                >
                  <img src={img} alt="" />
                </div>
              ))}
            </div>
          )}
          <div className="logo-tools">
            <button className="logo-btn" onClick={() => fileRef.current?.click()}>
              ↑ {logo ? 'Cambiar logo' : 'Probar mi logo'}
            </button>
            {logo && (
              <button className="logo-btn" onClick={() => setLogo(null)}>Quitar</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
            <span className="logo-hint">
              {logo ? 'Arrastrá el logo para posicionarlo · referencial' : 'Previsualización referencial'}
            </span>
          </div>
        </div>

        <div className="modal-right">
          <div className="modal-scroll">
            <h2>{producto.nombre}</h2>
            <p className="modal-desc">{producto.descripcion}</p>

            {producto.especificaciones?.length > 0 && (
              <div className="specs-box">
                {producto.especificaciones.map((s, i) => (
                  <div className="spec-item" key={i}>{s}</div>
                ))}
              </div>
            )}

            {producto.colores?.length > 0 && (
              <div>
                <span className="field-label">Opciones / Variantes</span>
                <div className="chips">
                  {producto.colores.map((c, i) => (
                    <button
                      key={c}
                      className={`chip${i === colorIdx ? ' selected' : ''}`}
                      onClick={() => setColorIdx(i)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="prod-data">
              {PROD_DATA.map(([k, v]) => (
                <div className="prod-data-row" key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>

            <div className="field qty-field">
              <span className="field-label">Cantidad estimada</span>
              <input
                type="number"
                min="10"
                step="10"
                value={cantidad}
                onChange={(e) =>
                  setCantidadState(Math.max(10, parseInt(e.target.value, 10) || 10))
                }
              />
            </div>
          </div>
          <div className="modal-ctas">
            <button className="modal-add" onClick={handleAdd}>
              Agregar al Carrito · {cantidad} u.
            </button>
            <button className="modal-wsp" onClick={handleWhatsApp}>
              Consultar por WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
