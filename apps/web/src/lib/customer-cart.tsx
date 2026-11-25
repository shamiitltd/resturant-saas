'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { publicFetch } from '@/lib/api';

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
  taxRatePercent?: number | null;
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
  taxRatePercent: number | null;
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
  const [tenantTaxRate, setTenantTaxRate] = useState<number | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Storage key namespaced to tenant
  const sessionKey = 'saas_table_session';
  const cartKey = tenantSlug ? `saas_customer_cart_${tenantSlug}` : 'saas_customer_cart';

  // Load from local storage and sync authoritative tenant tax rate
  useEffect(() => {
    try {
      const storedSession = localStorage.getItem(sessionKey);
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        setSessionState(parsed);
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

    // Refresh live tax rate from public menu if tenantSlug is known
    if (tenantSlug) {
      publicFetch<{ taxRatePercent?: number | null }>(`/v1/public/menu/${tenantSlug}`)
        .then((menuData) => {
          if (menuData && menuData.taxRatePercent !== undefined) {
            const numRate = menuData.taxRatePercent !== null ? Number(menuData.taxRatePercent) : null;
            setTenantTaxRate(numRate);
            setSessionState((prev) => {
              if (!prev) return prev;
              const updated = { ...prev, taxRatePercent: numRate };
              try {
                localStorage.setItem(sessionKey, JSON.stringify(updated));
              } catch {
                // ignore
              }
              return updated;
            });
          }
        })
        .catch(() => {
          // ignore background fetch failures
        });
    }
  }, [cartKey, tenantSlug]);

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

  const { subtotalMinor, taxMinor, totalMinor, totalItemCount, taxRatePercent } = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.itemTotalMinor, 0);
    const rate =
      session?.taxRatePercent !== undefined && session?.taxRatePercent !== null
        ? session.taxRatePercent
        : tenantTaxRate;
    const tax = rate !== null && rate > 0 ? Math.round(subtotal * (rate / 100)) : 0;
    const total = subtotal + tax;
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    return {
      subtotalMinor: subtotal,
      taxMinor: tax,
      totalMinor: total,
      totalItemCount: count,
      taxRatePercent: rate,
    };
  }, [items, session, tenantTaxRate]);

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
        taxRatePercent,
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
