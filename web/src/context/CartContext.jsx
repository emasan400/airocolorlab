import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { validateQuantity } from '../shared/quote-contract.mjs';
import { getTodosProductos } from '../lib/catalog';
import { loadItems, STORAGE_KEY, REVIEW_KEY } from '../lib/cart-store';
import { trackQuoteEvent } from '../lib/analytics';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [initial] = useState(() => loadItems(getTodosProductos()));
  const [items, setItems] = useState(initial.items);
  const [reviewItems, setReviewItems] = useState(initial.review || []);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState('');
  // persistAllowed=false → el original (posiblemente corrupto, con backup
  // fallido) NO se pisa: los efectos de escritura quedan bloqueados hasta
  // que el usuario decida explícitamente (Nuevo proyecto / recuperación).
  const persistAllowed = useRef(initial.persistAllowed !== false);
  const [persistWarn, setPersistWarn] = useState(initial.warning === 'corrupt-backed-up' ? 'corrupto preservado — tu selección anterior se mantuvo como backup'
    : initial.warning === 'corrupt-unbacked' ? 'selección corrupta preservada sin backup posible — queda intacta hasta que decidas'
    : initial.warning === 'storage-unavailable' ? 'storage no disponible — cambios solo en esta sesión'
    : initial.warning === 'review-needed' ? 'hay items pendientes de revisión' : null);
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!persistAllowed.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
    catch { persistAllowed.current = false; setPersistWarn('la selección no se pudo persistir — queda solo en esta sesión'); }
  }, [items]);

  useEffect(() => {
    if (!persistAllowed.current) return;
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify(reviewItems)); }
    catch { persistAllowed.current = false; setPersistWarn('la selección no se pudo persistir — queda solo en esta sesión'); }
  }, [reviewItems]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  // configuration_id distingue diseños: mismo producto+config suma cantidad;
  // configs distintas son líneas separadas. Cantidad validada SIEMPRE (mín 10,
  // múltiplos de 10) — nunca se acepta un valor inválido ni se redondea.
  const addItem = useCallback(
    (id_producto, titulo, cantidad = 10, extra = {}) => {
      const q = validateQuantity(cantidad);
      if (!q.ok) { showToast(`⚠ ${q.error}`); return false; }
      const { variant = null, configuration_id = null, preview = null, replace_configuration_id = null } = extra;
      setItems((prev) => {
        // reemplazo de diseño editado: el item con la config vieja se cambia
        // por el nuevo (misma línea — nunca duplicado)
        if (replace_configuration_id) {
          return prev.map((i) =>
            i.configuration_id === replace_configuration_id
              ? { id: id_producto, titulo, cantidad, variant, configuration_id, preview }
              : i
          );
        }
        const exists = prev.find((i) => i.id === id_producto && i.configuration_id === configuration_id);
        if (exists) {
          return prev.map((i) => (i === exists ? { ...i, cantidad: i.cantidad + cantidad } : i));
        }
        return [...prev, { id: id_producto, titulo, cantidad, variant, configuration_id, preview }];
      });
      // eventos agregados: ids + unidades + config_count — sin contacto/arte
      if (items.length === 0)
        trackQuoteEvent('quote_selection_started', { product_ids: [id_producto], units: cantidad, config_count: 1 });
      if (preview)
        trackQuoteEvent('quote_preview_saved', { product_ids: [id_producto], units: cantidad, config_count: 1 });
      if (items.length === 0 && !isOpen) setIsOpen(true);
      else showToast('✔ Agregado a tu cotización');
      return true;
    },
    [items.length, isOpen, showToast]
  );

  // Acepta solo cantidades válidas; el valor inválido lo maneja la UI
  // (se conserva lo tipeado y se muestra el error) — acá nunca entra 15.
  const setCantidad = useCallback((index, cantidad) => {
    if (!validateQuantity(cantidad).ok) return false;
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, cantidad } : it)));
    return true;
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeReviewItem = useCallback((index) => {
    setReviewItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Solo por acción explícita ("Nuevo proyecto") — limpia selección y
  // pendientes de revisión juntos; nunca automático tras éxito/error.
  const clearCart = useCallback(() => {
    setItems([]); setReviewItems([]);
    persistAllowed.current = true; // decisión explícita del usuario → se puede reescribir
    setPersistWarn(null);
  }, []);

  const totalUnidades = items.reduce((acc, i) => acc + i.cantidad, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        reviewItems,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addItem,
        setCantidad,
        removeItem,
        removeReviewItem,
        clearCart,
        totalUnidades,
        toast,
        showToast,
        persistWarn,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
