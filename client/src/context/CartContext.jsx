import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const { currentUser } = useAuth();
  const [cart, setCart] = useState([]);

  // Carts are per-customer: clear whenever the logged-in account changes (login / logout / switch).
  useEffect(() => { setCart([]); }, [currentUser?.id]);

  const addToCart = useCallback((product) => {
    setCart(prev => {
      if (prev.length > 0 && prev[0].dispensaryId !== product.dispensaryId) return [{ ...product, quantity: 1 }];
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((id) => setCart(prev => prev.filter(i => i.id !== id)), []);

  const updateCartQty = useCallback((id, qty) => {
    if (qty <= 0) return removeFromCart(id);
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateCartQty, clearCart, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
}
