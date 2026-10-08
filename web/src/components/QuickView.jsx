import { useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { openWhatsApp } from '../lib/secure';
import { MAX_LOGO_ORIGINAL_BYTES, MAX_PREVIEW_BYTES, validateQuantity, parseQuantityText } from '../shared/quote-contract.mjs';
import { exportMockupPng } from '../lib/mockup';
import MockupPreview from './MockupPreview';

const PROD_DATA = [
  ['Pedido mínimo', '10 unidades'],
  ['Producción', 'A pedido · sin stock fijo'],
  ['Personalización', 'Arte propio o asistido por el estudio'],
  ['Cotización', 'A medida según volumen y terminación'],
];

const newConfigId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

// Rasteriza el logo original a un preview PNG acotado (<=MAX_PREVIEW_BYTES).
// El original queda SOLO en memoria local — nunca se sube.
function rasterizeLogo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let side = 512;
      const trySize = () => {
        const scale = Math.min(1, side / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const dataUrl = c.toDataURL('image/png');
        const approx = Math.floor(dataUrl.length * 3 / 4);
        if (approx > MAX_PREVIEW_BYTES && side > 64) { side = Math.floor(side / 2); return trySize(); }
        if (approx > MAX_PREVIEW_BYTES) return reject(new Error('logo demasiado pesado aun reducido'));
        resolve(dataUrl);
      };
      trySize();
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen ilegible')); };
    img.src = url;
  });
}

// initialConfiguration: restaura un diseño guardado (edición explícita).
// Si el usuario cambia algo del diseño, se genera un configuration_id NUEVO;
// el item original se reemplaza vía replace_configuration_id (nunca duplicado).
export default function QuickView({ producto, onClose, initialConfiguration = null }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  // cantidadRaw conserva lo tipeado (incl. inválido); cantidad es el entero válido.
  const [cantidadRaw, setCantidadRaw] = useState('10');
  const [qtyError, setQtyError] = useState('');
  const [logo, setLogo] = useState(null);
  const [logoErr, setLogoErr] = useState('');
  const [logoPos, setLogoPos] = useState({ x: 50, y: 50 });
  const [logoScale, setLogoScale] = useState(1);
  const [logoRot, setLogoRot] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [configId, setConfigId] = useState(newConfigId);
  const fileRef = useRef(null);
  const stageRef = useRef(null);
  const modalRef = useRef(null);
  const closeRef = useRef(null);
  const { addItem } = useCart();

  // imgs se computa ANTES de cualquier early return (null-safe).
  const imgs = producto?.galeria?.length
    ? producto.galeria
    : producto?.imagen_principal ? [producto.imagen_principal] : [];

  const cantidadNum = parseQuantityText(cantidadRaw);
  const qtyValid = cantidadNum !== null && validateQuantity(cantidadNum).ok;

  // Restaura la configuración guardada (edición) o arranca limpio.
  useEffect(() => {
    const cfg = initialConfiguration;
    if (!producto) return;
    if (cfg) {
      const pv = cfg.preview || {};
      const imgIdx = imgs.findIndex((g) => g === pv.background);
      setImgIndex(imgIdx >= 0 ? imgIdx : 0);
      setColorIdx(Math.max(0, (producto.colores || []).indexOf(cfg.variant)));
      setCantidadRaw(String(cfg.cantidad ?? 10));
      setQtyError('');
      setLogo(pv.logo_data_url || null);
      setLogoErr('');
      setLogoPos({ x: pv.x ?? 50, y: pv.y ?? 50 });
      setLogoScale(pv.scale ?? 1);
      setLogoRot(pv.rotation ?? 0);
      setConfigId(cfg.configuration_id || newConfigId());
      return;
    }
    setImgIndex(0);
    setColorIdx(0);
    setCantidadRaw('10');
    setQtyError('');
    setLogo(null);
    setLogoErr('');
    setLogoPos({ x: 50, y: 50 });
    setLogoScale(1);
    setLogoRot(0);
    setConfigId(newConfigId());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto, initialConfiguration]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const els = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!els?.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!producto) return;
    const prev = document.activeElement;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, [producto]);

  if (!producto) return <div className="modal-overlay" />;

  const prev = () => setImgIndex((i) => (i - 1 + imgs.length) % imgs.length);
  const next = () => setImgIndex((i) => (i + 1) % imgs.length);

  const onQtyChange = (e) => {
    const v = e.target.value;
    setCantidadRaw(v); // conserva lo tipeado — nunca se redondea ni se corrige solo
    const n = parseQuantityText(v);
    setQtyError(v === '' ? '' : n === null ? 'ingresá solo números enteros' : validateQuantity(n).error || '');
  };

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoErr('');
    // Solo raster — nunca SVG/HTML ejecutable. El preview es referencial.
    if (!/^image\/(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.type))
      return setLogoErr('Subí un PNG, JPG o WebP (no SVG ni otros formatos).');
    if (file.size > MAX_LOGO_ORIGINAL_BYTES)
      return setLogoErr('El logo original supera los 3 MB.');
    try {
      const dataUrl = await rasterizeLogo(file);
      setLogo(dataUrl);
      setLogoPos({ x: 50, y: 50 });
      setLogoScale(1);
      setLogoRot(0);
      setConfigId(newConfigId());
    } catch {
      setLogoErr('No se pudo procesar el logo — probá con otro archivo.');
    }
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const onLogoPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onLogoPointerMove = (e) => {
    if (!dragging || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    setLogoPos({
      x: clamp(((e.clientX - r.left) / r.width) * 100, 4, 96),
      y: clamp(((e.clientY - r.top) / r.height) * 100, 4, 96),
    });
  };

  const onLogoPointerUp = () => setDragging(false);

  // Posición accesible por teclado: flechas mueven el logo (Shift = paso x5).
  const onLogoKeyDown = (e) => {
    const step = e.shiftKey ? 5 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    setLogoPos((p) => ({ x: clamp(p.x + d[0], 0, 100), y: clamp(p.y + d[1], 0, 100) }));
  };

  const resetLogo = () => {
    setLogoPos({ x: 50, y: 50 });
    setLogoScale(1);
    setLogoRot(0);
  };

  const previewOf = () => (logo ? {
    logo_data_url: logo, x: Math.round(logoPos.x), y: Math.round(logoPos.y),
    scale: Number(logoScale.toFixed(2)), rotation: logoRot,
    background: imgs[imgIndex] || producto.imagen_principal, version: 'v1',
  } : null);

  // ¿cambió algo del diseño respecto a la config original (edición)?
  const designChanged = () => {
    if (!initialConfiguration) return true;
    const o = initialConfiguration.preview || {};
    const now = previewOf();
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    return !(initialConfiguration.variant === (producto.colores?.[colorIdx] || null) && same(o, now));
  };

  const handleAdd = () => {
    if (!qtyValid) return; // bloqueado — nunca suma una cantidad inválida
    const color = producto.colores?.[colorIdx];
    const titulo = color ? `${producto.nombre} (${color})` : producto.nombre;
    const ok = addItem(producto.id_producto, titulo, cantidadNum, {
      variant: color || null,
      // edición con cambios → config nueva; sin cambios → mismo id
      configuration_id: designChanged() ? newConfigId() : configId,
      preview: previewOf(),
      replace_configuration_id: initialConfiguration?.configuration_id || null,
    });
    if (ok !== false) onClose();
  };

  // Exporta el mockup de referencia como PNG — misma geometría que la vista.
  const exportMockup = () => {
    const src = imgs[imgIndex];
    if (!src) return;
    exportMockupPng({
      background: src, logo_data_url: logo,
      x: logoPos.x, y: logoPos.y, scale: logoScale, rotation: logoRot,
    }, `mockup-${producto.id_producto}-referencial.png`).catch(() => setLogoErr('No se pudo exportar el mockup.'));
  };

  const handleWhatsApp = () => {
    const color = producto.colores?.[colorIdx];
    openWhatsApp(
      `¡Hola AIRO! Quiero consultar por *${producto.nombre}*` +
        (color ? ` en variante ${color}` : '') +
        (qtyValid ? `.\nCantidad estimada: ${cantidadNum} unidades.` : '.')
    );
  };

  return (
    <div
      className={`modal-overlay${producto ? ' open' : ''}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={producto.nombre} ref={modalRef}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar" ref={closeRef}>✕</button>

        <div className="modal-left">
          <div className="modal-imgbox" ref={stageRef}>
            {producto.badge && <span className="img-badge">{producto.badge}</span>}
            {imgs.length > 1 && (
              <>
                <button className="carousel-btn prev" onClick={prev} aria-label="Anterior">❮</button>
                <button className="carousel-btn next" onClick={next} aria-label="Siguiente">❯</button>
              </>
            )}
            <MockupPreview
              background={imgs[imgIndex]}
              logo={logo}
              x={logoPos.x} y={logoPos.y} scale={logoScale} rotation={logoRot}
              alt={producto.nombre}
              logoProps={{
                className: `mockup-logo${dragging ? ' dragging' : ''}`,
                tabIndex: 0,
                role: 'slider',
                'aria-label': 'Posición del logo (flechas para mover)',
                'aria-valuetext': `x ${Math.round(logoPos.x)}%, y ${Math.round(logoPos.y)}%`,
                onKeyDown: onLogoKeyDown,
                onPointerDown: onLogoPointerDown,
                onPointerMove: onLogoPointerMove,
                onPointerUp: onLogoPointerUp,
                onPointerCancel: onLogoPointerUp,
              }}
            />
          </div>
          {imgs.length > 1 && (
            <div className="thumbs" role="group" aria-label="Galería de imágenes">
              {imgs.map((img, i) => (
                <button
                  type="button"
                  key={i}
                  className={`thumb${i === imgIndex ? ' active' : ''}`}
                  onClick={() => setImgIndex(i)}
                  aria-label={`Imagen ${i + 1} de ${imgs.length}`}
                  aria-pressed={i === imgIndex}
                >
                  <img src={img} alt="" />
                </button>
              ))}
            </div>
          )}
          <div className="logo-tools">
            <button className="logo-btn" onClick={() => fileRef.current?.click()}>
              ↑ {logo ? 'Cambiar logo' : 'Probar mi logo'}
            </button>
            {logo && (
              <>
                <button className="logo-btn" onClick={resetLogo}>Reiniciar</button>
                <button className="logo-btn" onClick={() => setLogo(null)}>Quitar</button>
              </>
            )}
            <button className="logo-btn" onClick={exportMockup}>⬇ Guardar mockup</button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/bmp" hidden onChange={onLogo} />
            <span className="logo-hint">
              {logo ? 'Arrastrá o usá flechas · referencial, no arte final' : 'Previsualización referencial'}
            </span>
          </div>
          {logoErr && <p className="field-error" role="alert">{logoErr}</p>}
          {logo && (
            <div className="logo-ranges">
              <label className="logo-range">
                <span>X</span>
                <input type="range" min="0" max="100" step="1" value={Math.round(logoPos.x)}
                  aria-label="Posición horizontal del logo"
                  onChange={(e) => setLogoPos((p) => ({ ...p, x: Number(e.target.value) }))} />
                <b>{Math.round(logoPos.x)}%</b>
              </label>
              <label className="logo-range">
                <span>Y</span>
                <input type="range" min="0" max="100" step="1" value={Math.round(logoPos.y)}
                  aria-label="Posición vertical del logo"
                  onChange={(e) => setLogoPos((p) => ({ ...p, y: Number(e.target.value) }))} />
                <b>{Math.round(logoPos.y)}%</b>
              </label>
              <label className="logo-range">
                <span>Tamaño</span>
                <input
                  type="range" min="30" max="250" step="5"
                  value={Math.round(logoScale * 100)}
                  aria-label="Tamaño del logo"
                  onChange={(e) => setLogoScale(Number(e.target.value) / 100)}
                />
                <b>{Math.round(logoScale * 100)}%</b>
              </label>
              <label className="logo-range">
                <span>Rotación</span>
                <input
                  type="range" min="-45" max="45" step="1"
                  value={logoRot}
                  aria-label="Rotación del logo"
                  onChange={(e) => setLogoRot(Number(e.target.value))}
                />
                <b>{logoRot}°</b>
              </label>
            </div>
          )}
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
                      aria-pressed={i === colorIdx}
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
              <label className="field-label" htmlFor="qv-qty">Cantidad estimada (mín. 10, múltiplos de 10)</label>
              <input
                id="qv-qty"
                type="number"
                min="10"
                step="10"
                value={cantidadRaw}
                onChange={onQtyChange}
                aria-invalid={!!qtyError}
                aria-describedby={qtyError ? 'qv-qty-err' : undefined}
              />
              {qtyError && <p className="field-error" id="qv-qty-err" role="alert">{qtyError}</p>}
            </div>
          </div>
          <div className="modal-ctas">
            <button className="modal-add" onClick={handleAdd} disabled={!qtyValid}>
              Sumar a cotización{qtyValid ? ` · ${cantidadNum} u.` : ''}
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
