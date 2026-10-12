import { useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { openWhatsApp } from '../lib/secure';
import { MAX_LOGO_ORIGINAL_BYTES, MAX_PREVIEW_BYTES, validateQuantity, parseQuantityText } from '../shared/quote-contract.mjs';
import { exportMockupPng } from '../lib/mockup';
import MockupPreview from './MockupPreview';

const PROD_DATA = [
  ['Pedido mínimo', '10 unidades'],
  ['Producción', 'A pedido · sin stock fijo'],
  ['Desarrollo', 'Arte propio o desarrollado por el estudio'],
  ['Cotización', 'A medida según volumen y terminación'],
];

const newConfigId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

// Rasteriza el logo original a un preview PNG acotado (<=MAX_PREVIEW_BYTES).
// El original queda SOLO en memoria local — nunca se sube.
function rasterizeLogo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('imagen ilegible'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('imagen ilegible'));
      img.onload = () => {
        const w = img.naturalWidth || img.width || 1024;
        const h = img.naturalHeight || img.height || 1024;
        let side = 1024;
        const trySize = () => {
          const scale = Math.min(1, side / Math.max(w, h));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * scale));
          c.height = Math.max(1, Math.round(h * scale));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          const dataUrl = c.toDataURL('image/png');
          const approx = Math.floor(dataUrl.length * 3 / 4);
          if (approx > MAX_PREVIEW_BYTES && side > 64) { side = Math.floor(side / 2); return trySize(); }
          if (approx > MAX_PREVIEW_BYTES) return reject(new Error('logo demasiado pesado aun reducido'));
          resolve(dataUrl);
        };
        try {
          trySize();
        } catch (error) {
          reject(error);
        }
      };
      if (typeof reader.result !== 'string') return reject(new Error('imagen ilegible'));
      const extension = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase();
      const mimeByExtension = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
        gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml',
      };
      const mime = file.type || mimeByExtension[extension];
      img.src = reader.result.replace(/^data:[^,]*,/, `data:${mime};base64,`);
    };
    reader.readAsDataURL(file);
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
  const logoPointersRef = useRef(new Map());
  const logoGestureRef = useRef(null);
  const logoPosRef = useRef(logoPos);
  const logoScaleRef = useRef(logoScale);
  const logoRotRef = useRef(logoRot);
  const { addItem } = useCart();

  const setLogoPosValue = (next) => {
    const value = typeof next === 'function' ? next(logoPosRef.current) : next;
    logoPosRef.current = value;
    setLogoPos(value);
  };
  const setLogoScaleValue = (next) => {
    logoScaleRef.current = next;
    setLogoScale(next);
  };
  const setLogoRotValue = (next) => {
    logoRotRef.current = next;
    setLogoRot(next);
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const normalizeRotation = (v) => {
    const normalized = ((v + 180) % 360 + 360) % 360 - 180;
    return normalized === -180 ? 180 : normalized;
  };

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
      setLogoPosValue({ x: pv.x ?? 50, y: pv.y ?? 50 });
      setLogoScaleValue(pv.scale ?? 1);
      setLogoRotValue(pv.rotation ?? 0);
      logoPointersRef.current.clear();
      logoGestureRef.current = null;
      setDragging(false);
      setConfigId(cfg.configuration_id || newConfigId());
      return;
    }
    setImgIndex(0);
    setColorIdx(0);
    setCantidadRaw('10');
    setQtyError('');
    setLogo(null);
    setLogoErr('');
    setLogoPosValue({ x: 50, y: 50 });
    setLogoScaleValue(1);
    setLogoRotValue(0);
    logoPointersRef.current.clear();
    logoGestureRef.current = null;
    setDragging(false);
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
    // Se acepta SVG solo como ENTRADA: se rasteriza a PNG en el canvas local; al servidor nunca viaja SVG.
    const supportedType = /^image\/(png|jpe?g|webp|gif|avif|bmp|svg\+xml)$/i.test(file.type);
    const supportedExtension = !file.type && /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(file.name);
    if (!supportedType && !supportedExtension)
      return setLogoErr('Para la previsualización usá PNG, JPG, WebP o SVG. Los archivos vectoriales (AI, EPS, PDF) los podés mandar por WhatsApp al cotizar.');
    if (file.size > MAX_LOGO_ORIGINAL_BYTES)
      return setLogoErr('El archivo supera los 10 MB — exportá una versión más liviana.');
    try {
      const dataUrl = await rasterizeLogo(file);
      setLogo(dataUrl);
      setLogoPosValue({ x: 50, y: 50 });
      setLogoScaleValue(1);
      setLogoRotValue(0);
      setConfigId(newConfigId());
    } catch {
      setLogoErr('No pudimos leer ese archivo. Probá exportarlo como PNG o JPG.');
    }
  };

  const onLogoPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pointers = logoPointersRef.current;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      logoGestureRef.current = {
        mode: 'drag',
        pointerId: e.pointerId,
        point: { x: e.clientX, y: e.clientY },
        position: logoPosRef.current,
      };
    } else if (pointers.size === 2) {
      const [{ x: x1, y: y1 }, { x: x2, y: y2 }] = pointers.values();
      logoGestureRef.current = {
        mode: 'pinch',
        distance: Math.hypot(x2 - x1, y2 - y1) || 1,
        angle: Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI,
        scale: logoScaleRef.current,
        rotation: logoRotRef.current,
      };
    }
    setDragging(true);
  };

  const onLogoPointerMove = (e) => {
    const pointers = logoPointersRef.current;
    if (!pointers.has(e.pointerId) || !stageRef.current) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = [...pointers.values()];
    if (points.length >= 2) {
      const [{ x: x1, y: y1 }, { x: x2, y: y2 }] = points;
      const gesture = logoGestureRef.current;
      if (gesture?.mode !== 'pinch') return;
      const distance = Math.hypot(x2 - x1, y2 - y1);
      const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      const scale = clamp(gesture.scale * (distance / gesture.distance), 0.3, 2.5);
      const rotation = Math.round(normalizeRotation(gesture.rotation + normalizeRotation(angle - gesture.angle)));
      setLogoScaleValue(Number(scale.toFixed(2)));
      setLogoRotValue(rotation);
      return;
    }
    const gesture = logoGestureRef.current;
    if (gesture?.mode !== 'drag' || gesture.pointerId !== e.pointerId) return;
    const r = stageRef.current.getBoundingClientRect();
    setLogoPosValue({
      x: clamp(gesture.position.x + ((e.clientX - gesture.point.x) / r.width) * 100, 4, 96),
      y: clamp(gesture.position.y + ((e.clientY - gesture.point.y) / r.height) * 100, 4, 96),
    });
  };

  const onLogoPointerUp = (e) => {
    const pointers = logoPointersRef.current;
    pointers.delete(e.pointerId);
    const remaining = [...pointers.entries()];
    if (remaining.length === 1) {
      const [pointerId, point] = remaining[0];
      logoGestureRef.current = {
        mode: 'drag',
        pointerId,
        point,
        position: logoPosRef.current,
      };
    } else if (remaining.length >= 2) {
      const p1 = remaining[0][1];
      const p2 = remaining[1][1];
      logoGestureRef.current = {
        mode: 'pinch',
        distance: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
        angle: Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI,
        scale: logoScaleRef.current,
        rotation: logoRotRef.current,
      };
    } else {
      logoGestureRef.current = null;
    }
    setDragging(remaining.length > 0);
  };

  // Posición accesible por teclado: flechas mueven el logo (Shift = paso x5).
  const onLogoKeyDown = (e) => {
    const step = e.shiftKey ? 5 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) {
      e.preventDefault();
      setLogoPosValue((p) => ({ x: clamp(p.x + d[0], 0, 100), y: clamp(p.y + d[1], 0, 100) }));
      return;
    }
    if (e.key === '[' || e.key === ']' || e.key === '{' || e.key === '}') {
      e.preventDefault();
      const rotationStep = e.shiftKey ? 15 : 1;
      setLogoRotValue(Math.round(normalizeRotation(logoRotRef.current + (e.key === '[' || e.key === '{' ? -rotationStep : rotationStep))));
      return;
    }
    if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault();
      const delta = e.key === '-' ? -0.05 : 0.05;
      setLogoScaleValue(Number(clamp(logoScaleRef.current + delta, 0.3, 2.5).toFixed(2)));
    }
  };

  const resetLogo = () => {
    setLogoPosValue({ x: 50, y: 50 });
    setLogoScaleValue(1);
    setLogoRotValue(0);
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
                'aria-label': 'Logo: flechas mueven, [ ] rotan, + − escalan',
                'aria-valuetext': `x ${Math.round(logoPos.x)}%, y ${Math.round(logoPos.y)}%, rotación ${logoRot}°, tamaño ${Math.round(logoScale * 100)}%`,
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
                <button className="logo-btn" onClick={() => setLogoRotValue(Math.round(normalizeRotation(logoRotRef.current - 90)))}>−90°</button>
                <button className="logo-btn" onClick={() => setLogoRotValue(Math.round(normalizeRotation(logoRotRef.current + 90)))}>+90°</button>
                <button className="logo-btn" onClick={() => setLogo(null)}>Quitar</button>
              </>
            )}
            <button className="logo-btn" onClick={exportMockup}>⬇ Guardar mockup</button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.avif,.bmp,.svg" hidden onChange={onLogo} />
            <span className="logo-hint">
              {logo ? 'Arrastrá para mover · pellizcá o usá los controles para tamaño y giro · referencial, no arte final' : 'Previsualización referencial'}
            </span>
          </div>
          {logoErr && <p className="field-error" role="alert">{logoErr}</p>}
          {logo && (
            <div className="logo-ranges">
              <label className="logo-range">
                <span>X</span>
                <input type="range" min="0" max="100" step="1" value={Math.round(logoPos.x)}
                  aria-label="Posición horizontal del logo"
                  onChange={(e) => setLogoPosValue((p) => ({ ...p, x: Number(e.target.value) }))} />
                <b>{Math.round(logoPos.x)}%</b>
              </label>
              <label className="logo-range">
                <span>Y</span>
                <input type="range" min="0" max="100" step="1" value={Math.round(logoPos.y)}
                  aria-label="Posición vertical del logo"
                  onChange={(e) => setLogoPosValue((p) => ({ ...p, y: Number(e.target.value) }))} />
                <b>{Math.round(logoPos.y)}%</b>
              </label>
              <label className="logo-range">
                <span>Tamaño</span>
                <input
                  type="range" min="30" max="250" step="5"
                  value={Math.round(logoScale * 100)}
                  aria-label="Tamaño del logo"
                  onChange={(e) => setLogoScaleValue(Number(e.target.value) / 100)}
                />
                <b>{Math.round(logoScale * 100)}%</b>
              </label>
              <label className="logo-range">
                <span>Rotación</span>
                <input
                  type="range" min="-180" max="180" step="1"
                  value={logoRot}
                  aria-label="Rotación del logo"
                  onChange={(e) => setLogoRotValue(Number(e.target.value))}
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
