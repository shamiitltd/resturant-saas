'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  User,
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import type { StaffOrderDto } from '@restaurant-saas/contracts';

export default function WaiterDashboardPage() {
  const [orders, setOrders] = useState<StaffOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'READY' | 'DELIVERED'>('ALL');

  const loadWaiterOrders = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await fetchWithAuth<StaffOrderDto[]>('/v1/staff/orders');
      // Waiter view focuses on READY, SERVED, and recently COMPLETED orders
      const waiterOrders = data.filter((o) => o.status === 'READY' || o.status === 'SERVED' || o.status === 'COMPLETED');
      setOrders(waiterOrders);
      setLastRefreshed(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch waiter queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWaiterOrders(false);

    // 5-second polling for waiter station
    const interval = setInterval(() => {
      loadWaiterOrders(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadWaiterOrders]);

  const handlePickup = async (orderId: string) => {
    try {
      setActionInProgress(orderId);
      await fetchWithAuth(`/v1/staff/orders/${orderId}/pickup`, {
        method: 'PATCH',
      });
      await loadWaiterOrders(true);
    } catch (err: any) {
      alert(err.message || 'Failed to claim order pickup');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleMarkServed = async (orderId: string) => {
    try {
      setActionInProgress(orderId);
      await fetchWithAuth(`/v1/staff/orders/${orderId}/served`, {
        method: 'PATCH',
      });
      await loadWaiterOrders(true);
    } catch (err: any) {
      alert(err.message || 'Failed to mark order served');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleComplete = async (orderId: string) => {
    try {
      setActionInProgress(orderId);
      await fetchWithAuth(`/v1/staff/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      await loadWaiterOrders(true);
    } catch (err: any) {
      alert(err.message || 'Failed to complete order');
    } finally {
      setActionInProgress(null);
    }
  };

  const readyOrders = orders.filter((o) => o.status === 'READY');
  const deliveredOrders = orders.filter((o) => o.status === 'SERVED' || o.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      {/* Waiter Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-white p-5 rounded-2xl shadow-xs gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-white shadow-md shadow-orange-600/20">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-lg">Waiter & Table Service</h1>
            <p className="text-xs text-slate-500">
              Food Pickup & Delivery Station &bull; Synced {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{readyOrders.length} Ready to Serve</span>
          </div>

          <button
            type="button"
            onClick={() => loadWaiterOrders(false)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-orange-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* View Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`rounded-xl px-3 py-1.5 transition ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Orders ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('READY')}
          className={`rounded-xl px-3 py-1.5 transition ${
            activeTab === 'READY'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Ready to Deliver ({readyOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('DELIVERED')}
          className={`rounded-xl px-3 py-1.5 transition ${
            activeTab === 'DELIVERED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Delivered & Shift History ({deliveredOrders.length})
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Section: Ready for Table Delivery */}
      {(activeTab === 'ALL' || activeTab === 'READY') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Ready for Delivery ({readyOrders.length})
            </h2>
            <span className="text-xs text-slate-500">
              Food is hot and plated on the kitchen counter
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-orange-600 mb-2" />
              <p className="text-xs font-semibold">Loading ready plates...</p>
            </div>
          ) : readyOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <UtensilsCrossed className="h-10 w-10 text-slate-300 mb-2" />
              <h3 className="font-bold text-slate-800 text-sm">No Orders Waiting for Delivery</h3>
              <p className="mt-1 text-xs text-slate-500">
                When the kitchen marks dishes as READY, they will appear here immediately.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyOrders.map((order) => {
                const isCounter = order.serviceMode === 'COUNTER_SERVICE';
                const isClaimedByMe = Boolean(order.waiterId);

                return (
                  <div
                    key={order.id}
                    className="flex flex-col justify-between rounded-2xl border-2 border-emerald-200 bg-white p-5 shadow-sm hover:shadow-md transition"
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-xl bg-emerald-600 px-3 py-1 text-sm font-black text-white">
                              {order.tableCode}
                            </span>
                            <span className="font-bold text-slate-900 text-base">
                              #{order.orderNumber}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {order.tableLabel} &bull;{' '}
                            <span className="font-semibold text-slate-700">
                              {isCounter ? 'Counter Pickup' : 'Dine-In Table Delivery'}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 uppercase">
                            READY
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1">
                            {order.elapsedMinutes}m ago
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="py-3 space-y-1.5">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="font-bold text-slate-900">
                              {item.quantity}x {item.itemName}
                            </span>
                            {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                              <span className="text-[10px] text-slate-500">
                                ({item.selectedModifiers.map((m) => m.name).join(', ')})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {order.specialInstructions && (
                        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs font-semibold text-amber-900">
                          Note: &ldquo;{order.specialInstructions}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Waiter Actions */}
                    <div className="pt-3 border-t border-slate-100 flex gap-2">
                      {!isCounter ? (
                        <>
                          <button
                            type="button"
                            disabled={actionInProgress === order.id}
                            onClick={() => handlePickup(order.id)}
                            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          >
                            Pick Up Tray
                          </button>
                          <button
                            type="button"
                            disabled={actionInProgress === order.id}
                            onClick={() => handleMarkServed(order.id)}
                            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                          >
                            Mark Served
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={actionInProgress === order.id}
                          onClick={() => handleComplete(order.id)}
                          className="w-full rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white hover:bg-purple-700 shadow-sm disabled:opacity-50"
                        >
                          Customer Collected (Complete)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recently Delivered & Completed Section */}
      {(activeTab === 'ALL' || activeTab === 'DELIVERED') && deliveredOrders.length > 0 && (
        <div className="mt-8 space-y-4 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
              Delivered Dishes ({deliveredOrders.length})
            </h2>
            <span className="text-xs text-slate-400">
              Shift deliveries & settled orders
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {deliveredOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-xs">
                      #{order.orderNumber}
                    </span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                      {order.tableCode}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {order.items.reduce((acc, i) => acc + i.quantity, 0)} items served
                  </span>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {order.status === 'COMPLETED' ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span>Settled</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        <CheckCircle2 className="h-3 w-3 text-blue-600" />
                        <span>Delivered</span>
                      </span>
                      <button
                        type="button"
                        disabled={actionInProgress === order.id}
                        onClick={() => handleComplete(order.id)}
                        className="rounded-lg bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-slate-900 transition disabled:opacity-50"
                      >
                        Clear Table
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
