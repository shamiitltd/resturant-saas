'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export interface CartModifier {
  id: string;
  name: string;
  priceMinor: number;
}

export interface CartItem {
  cartItemId: string; // unique key in cart
  itemId: string;
  name: string;
  isVegetarian: boolean;
  basePriceMinor: number;
  unitPriceMinor: number; // basePriceMinor + sum(modifier prices)
  quantity: number;
  notes?: string;
  selectedModifiers: CartModifier[];
  itemTotalMinor: number;
}

export interface TableSessionData {
  tableSessionId: string;
  sessionToken: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  locationId: string;
  locationName: string;
  tableId: string;
  tableCode: string;
  tableLabel: string;
  currency: string;
}

interface CartContextValue {
  session: TableSessionData | null;
  setSession: (session: TableSessionData | null) => void;
  items: CartItem[];
  addItem: (
    item: {
      id: string;
      name: string;
      isVegetarian: boolean;
      basePriceMinor: number;
    },
    quantity: number,
    selectedModifiers: CartModifier[],
    notes?: string
  ) => void;
  updateQuantity: (cartItemId: string, newQuantity: number) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  totalItemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CustomerCartProvider({
  children,
  tenantSlug,
}: {
  children: React.ReactNode;
  tenantSlug?: string;
}) {
  const [session, setSessionState] = useState<TableSessionData | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Storage key namespaced to tenant
  const sessionKey = 'saas_table_session';
  const cartKey = tenantSlug ? `saas_customer_cart_${tenantSlug}` : 'saas_customer_cart';

  // Load from local storage
  useEffect(() => {
    try {
      const storedSession = localStorage.getItem(sessionKey);
      if (storedSession) {
        setSessionState(JSON.parse(storedSession));
      }
      const storedCart = localStorage.getItem(cartKey);
      if (storedCart) {
        setItems(JSON.parse(storedCart));
      }
    } catch {
      // Ignore parse errors
    } finally {
      setIsLoaded(true);
    }
  }, [cartKey]);

  // Persist cart changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(cartKey, JSON.stringify(items));
    } catch {
      // Storage quota or disabled
    }
  }, [items, isLoaded, cartKey]);

  const setSession = (newSession: TableSessionData | null) => {
    setSessionState(newSession);
    try {
      if (newSession) {
        localStorage.setItem(sessionKey, JSON.stringify(newSession));
      } else {
        localStorage.removeItem(sessionKey);
      }
    } catch {
      // Ignore
    }
  };

  const addItem = (
    item: {
      id: string;
      name: string;
      isVegetarian: boolean;
      basePriceMinor: number;
    },
    quantity: number,
    selectedModifiers: CartModifier[],
    notes?: string
  ) => {
    const modifierSum = selectedModifiers.reduce((sum, mod) => sum + mod.priceMinor, 0);
    const unitPriceMinor = item.basePriceMinor + modifierSum;
    const itemTotalMinor = unitPriceMinor * quantity;

    // Check if identical item configuration exists
    const modKey = selectedModifiers.map((m) => m.id).sort().join('-');
    const cartItemId = `${item.id}-${modKey}-${notes?.trim() || 'std'}`;

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.cartItemId === cartItemId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          itemTotalMinor: updated[existingIndex].unitPriceMinor * newQty,
        };
        return updated;
      }

      return [
        ...prev,
        {
          cartItemId,
          itemId: item.id,
          name: item.name,
          isVegetarian: item.isVegetarian,
          basePriceMinor: item.basePriceMinor,
          unitPriceMinor,
          quantity,
          notes,
          selectedModifiers,
          itemTotalMinor,
        },
      ];
    });
  };

  const updateQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(cartItemId);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? {
              ...item,
              quantity: newQuantity,
              itemTotalMinor: item.unitPriceMinor * newQuantity,
            }
          : item
      )
    );
  };

  const removeItem = (cartItemId: string) => {
    setItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(cartKey);
    } catch {
      // Ignore
    }
  };

  const { subtotalMinor, taxMinor, totalMinor, totalItemCount } = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.itemTotalMinor, 0);
    const tax = Math.round(subtotal * 0.05); // 5% GST
    const total = subtotal + tax;
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    return {
      subtotalMinor: subtotal,
      taxMinor: tax,
      totalMinor: total,
      totalItemCount: count,
    };
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        session,
        setSession,
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        subtotalMinor,
        taxMinor,
        totalMinor,
        totalItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCustomerCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCustomerCart must be used within a CustomerCartProvider');
  }
  return ctx;
}
