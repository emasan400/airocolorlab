import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'airo_cart_b2b';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  const addItem = useCallback(
    (id_producto, titulo, cantidad = 10) => {
      setItems((prev) => {
        const exists = prev.find((i) => i.id === id_producto && i.titulo === titulo);
        if (exists) {
          return prev.map((i) =>
            i === exists ? { ...i, cantidad: i.cantidad + cantidad } : i
          );
        }
        return [...prev, { id: id_producto, titulo, cantidad }];
      });
      // Primer producto: abrir el drawer directamente; si no, toast.
      if (items.length === 0 && !isOpen) setIsOpen(true);
      else showToast('✔ Agregado a tu cotización');
    },
    [items.length, isOpen, showToast]
  );

  const setCantidad = useCallback((index, cantidad) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, cantidad: Math.max(1, cantidad) } : it))
    );
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalUnidades = items.reduce((acc, i) => acc + i.cantidad, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addItem,
        setCantidad,
        removeItem,
        clearCart,
        totalUnidades,
        toast,
        showToast,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
