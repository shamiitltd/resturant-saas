'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { publicFetch } from '@/lib/api';
import { CustomerCartProvider, useCustomerCart } from '@/lib/customer-cart';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  UtensilsCrossed,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type { CustomerOrderResponseDto } from '@restaurant-saas/contracts';

function CartCheckoutContent() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;

  const {
    session,
    setSession,
    items,
    updateQuantity,
    removeItem,
    clearCart,
    subtotalMinor,
    taxMinor,
    totalMinor,
    taxRatePercent,
  } = useCustomerCart();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectingTable, setConnectingTable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConnectDemoTable = async () => {
    try {
      setConnectingTable(true);
      setErrorMessage(null);
      const data = await publicFetch<any>('/v1/public/table/resolve-qr', {
        method: 'POST',
        body: JSON.stringify({ qrToken: 'demo-table-4' }),
      });
      setSession(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to Table 4');
    } finally {
      setConnectingTable(false);
    }
  };

  const handlePlaceOrder = async () => {
    let activeSession = session;
    if (!activeSession || !activeSession.sessionToken) {
      // Auto-connect to demo table so customer is not blocked
      try {
        const data = await publicFetch<any>('/v1/public/table/resolve-qr', {
          method: 'POST',
          body: JSON.stringify({ qrToken: 'demo-table-4' }),
        });
        setSession(data);
        activeSession = data;
      } catch (tableErr: any) {
        setErrorMessage('No active table session found. Please connect to a table before placing your order.');
        return;
      }
    }

    if (!activeSession) {
      setErrorMessage('No active table session found. Please connect to a table before placing your order.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Your cart is empty.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Unique idempotency key per checkout attempt
      const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const payload = {
        sessionToken: activeSession.sessionToken,
        idempotencyKey,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          modifierIds: item.selectedModifiers.map((m) => m.id),
          notes: item.notes,
        })),
      };

      const orderResult = await publicFetch<CustomerOrderResponseDto>('/v1/customer/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Clear cart upon successful order creation
      clearCart();

      // Navigate to order tracking page
      router.push(`/${tenantSlug}/order/${orderResult.orderId}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit order. Please ask staff for assistance.');
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
          <UtensilsCrossed className="h-8 w-8" />
        </div>
        <h2 className="mt-4 font-extrabold text-slate-900 text-xl">Your Cart is Empty</h2>
        <p className="mt-1 text-sm text-slate-500">
          Discover our mouth-watering dishes and add them to your order.
        </p>
        <Link
          href={`/${tenantSlug}/menu`}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 font-bold text-sm text-white shadow-md shadow-orange-200 transition hover:bg-orange-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Browse Menu</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 pb-20">
      {/* Back to Menu */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/${tenantSlug}/menu`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Menu</span>
        </Link>
        <button
          onClick={clearCart}
          className="text-xs font-medium text-red-600 hover:underline"
        >
          Clear Cart
        </button>
      </div>

      {/* Table Badge Header */}
      {session ? (
        <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-xs mb-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
              Table Order
            </span>
            <h1 className="font-extrabold text-slate-900 text-lg">
              {session.tenantName} • {session.tableLabel}
            </h1>
          </div>
          <span className="rounded-lg bg-orange-50 px-2.5 py-1 font-extrabold text-orange-700 text-xs">
            {session.tableCode}
          </span>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Table Connection Required</span>
            </div>
            <p className="text-xs text-amber-700 mt-0.5">
              Dine-in orders are served to your table. Connect to Table 4 to proceed.
            </p>
          </div>
          <button
            type="button"
            disabled={connectingTable}
            onClick={handleConnectDemoTable}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition"
          >
            {connectingTable ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <span>Connect Table 4 (T-04)</span>
            )}
          </button>
        </div>
      )}

      {/* Cart Items List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden mb-5">
        <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/50">
          <h2 className="font-bold text-slate-900 text-sm">Order Items ({items.length})</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.cartItemId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-xs border p-0.5 ${
                      item.isVegetarian ? 'border-emerald-600' : 'border-red-600'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.isVegetarian ? 'bg-emerald-600' : 'bg-red-600'
                      }`}
                    />
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                </div>

                {/* Modifiers List */}
                {item.selectedModifiers.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.selectedModifiers.map((m) => (
                      <span
                        key={m.id}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {m.name} {m.priceMinor > 0 && `(+₹${(m.priceMinor / 100).toFixed(2)})`}
                      </span>
                    ))}
                  </div>
                )}

                {item.notes && (
                  <p className="mt-1 text-xs italic text-slate-500">Note: {item.notes}</p>
                )}

                <div className="mt-1 text-xs font-semibold text-slate-700">
                  ₹{(item.unitPriceMinor / 100).toFixed(2)} each
                </div>
              </div>

              {/* Quantity controls & item total */}
              <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center">
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-600 shadow-xs hover:bg-slate-100"
                  >
                    {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5 text-red-500" /> : <Minus className="h-3.5 w-3.5" />}
                  </button>
                  <span className="w-8 text-center font-bold text-slate-900 text-xs">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-600 shadow-xs hover:bg-slate-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <span className="w-20 text-right font-extrabold text-slate-900 text-sm">
                  ₹{(item.itemTotalMinor / 100).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Optional Contact Info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs mb-5">
        <h3 className="font-bold text-slate-900 text-sm mb-3">Customer Details (Optional)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Your Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Rahul"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm placeholder:text-slate-400 focus:border-orange-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm placeholder:text-slate-400 focus:border-orange-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Bill Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs mb-6">
        <h3 className="font-bold text-slate-900 text-sm mb-3">Bill Breakdown</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Item Subtotal</span>
            <span className="font-semibold text-slate-900">₹{(subtotalMinor / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>
              {taxRatePercent !== null && taxRatePercent !== undefined
                ? `Taxes & GST (${taxRatePercent}%)`
                : 'Taxes (Unconfigured)'}
            </span>
            <span className="font-semibold text-slate-900">₹{(taxMinor / 100).toFixed(2)}</span>
          </div>
          <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
            <div>
              <span className="font-extrabold text-slate-900 text-base">Total Amount</span>
              <p className="text-[11px] text-slate-500">Pay at table after dining</p>
            </div>
            <span className="font-extrabold text-orange-600 text-xl">
              ₹{(totalMinor / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Place Order CTA */}
      <button
        type="button"
        disabled={isSubmitting}
        onClick={handlePlaceOrder}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 py-4 font-bold text-white shadow-xl shadow-orange-600/20 transition hover:bg-orange-700 active:scale-[0.99] disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Sending Order to Kitchen...</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5" />
            <span>Confirm & Send to Kitchen • ₹{(totalMinor / 100).toFixed(2)}</span>
          </>
        )}
      </button>

      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>Prices verified server-side • One consolidated bill per table</span>
      </div>
    </div>
  );
}

export default function CartCheckoutPage() {
  const params = useParams();
  const tenantSlug = params.tenantSlug as string;

  return (
    <CustomerCartProvider tenantSlug={tenantSlug}>
      <CartCheckoutContent />
    </CustomerCartProvider>
  );
}
