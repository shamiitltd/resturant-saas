'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Volume2,
  RefreshCw,
  BellRing,
  Filter,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import type { StaffOrderDto } from '@restaurant-saas/contracts';
import SetEtaModal from '../components/SetEtaModal';
import CancelOrderModal from '../components/CancelOrderModal';

export default function KitchenDisplaySystemPage() {
  const [orders, setOrders] = useState<StaffOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<StaffOrderDto | null>(null);
  const [isEtaModalOpen, setIsEtaModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const loadKdsOrders = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await fetchWithAuth<StaffOrderDto[]>('/v1/staff/orders');
      
      // Filter out completed or cancelled orders from the kitchen display
      const activeKitchenOrders = data.filter(
        (o) => o.status === 'PLACED' || o.status === 'ACCEPTED' || o.status === 'PREPARING' || o.status === 'READY'
      );

      setOrders((prev) => {
        const prevPlacedIds = new Set(prev.filter((o) => o.status === 'PLACED').map((o) => o.id));
        const hasNew = activeKitchenOrders.some((o) => o.status === 'PLACED' && !prevPlacedIds.has(o.id));
        if (hasNew && prev.length > 0) {
          setNewOrderAlert(true);
        }
        return activeKitchenOrders;
      });

      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load KDS tickets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadKdsOrders(false);

    // 5-second automatic polling for live kitchen sync
    const interval = setInterval(() => {
      loadKdsOrders(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadKdsOrders]);

  const handleStatusTransition = async (orderId: string, nextStatus: string) => {
    try {
      await fetchWithAuth(`/v1/staff/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadKdsOrders(true);
    } catch (err: any) {
      alert(err.message || 'Failed to transition order status');
    }
  };

  const handleSetEta = async (etaMinutes: number, notes?: string) => {
    if (!selectedOrder) return;
    await fetchWithAuth(`/v1/staff/orders/${selectedOrder.id}/eta`, {
      method: 'PATCH',
      body: JSON.stringify({ chefEtaMinutes: etaMinutes, notes }),
    });
    // Also move to PREPARING if it was PLACED
    if (selectedOrder.status === 'PLACED' || selectedOrder.status === 'ACCEPTED') {
      await fetchWithAuth(`/v1/staff/orders/${selectedOrder.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PREPARING' }),
      });
    }
    await loadKdsOrders(true);
    setSelectedOrder(null);
  };

  const handleCancel = async (reason: string) => {
    if (!selectedOrder) return;
    await fetchWithAuth(`/v1/staff/orders/${selectedOrder.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: selectedOrder.status === 'PLACED' ? 'REJECTED' : 'CANCELLED',
        rejectionReason: reason,
      }),
    });
    await loadKdsOrders(true);
    setSelectedOrder(null);
  };

  // Divide into 3 operational KDS lanes
  const placedLane = orders.filter((o) => o.status === 'PLACED');
  const prepLane = orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING');
  const readyLane = orders.filter((o) => o.status === 'READY');

  const getTimerBadge = (minutes: number) => {
    if (minutes < 10) {
      return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    }
    if (minutes < 20) {
      return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    }
    return 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse';
  };

  return (
    <div className="flex flex-col min-h-[85vh] bg-slate-950 text-slate-100 rounded-3xl p-4 sm:p-6 shadow-2xl">
      {/* KDS Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-600/30">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wide">
              Kitchen Display System (KDS)
            </h1>
            <p className="text-xs text-slate-400">
              Live Cooking Stations &bull; Synced {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>

        {/* New Ticket Pulse Beacon */}
        {newOrderAlert && (
          <div className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-white font-black text-xs animate-bounce">
            <BellRing className="h-4 w-4" />
            <span>NEW INCOMING TICKET!</span>
            <button
              onClick={() => setNewOrderAlert(false)}
              className="ml-2 rounded-md bg-white/20 px-2 py-0.5 text-[10px] hover:bg-white/30"
            >
              ACK
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400">
            Active Tickets: <span className="text-white font-extrabold">{orders.length}</span>
          </span>
          <button
            type="button"
            onClick={() => loadKdsOrders(false)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-orange-500' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 3-Column KDS Multi-Lane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start">
        {/* Lane 1: NEW / PLACED */}
        <div className="flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 p-4 min-h-[600px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-orange-500" />
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-white">
                New Tickets
              </h2>
            </div>
            <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs font-extrabold text-orange-400 border border-orange-500/30">
              {placedLane.length}
            </span>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {placedLane.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-600 text-center">
                <ChefHat className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-xs font-semibold">No new incoming orders</p>
              </div>
            ) : (
              placedLane.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border-2 border-orange-500/60 bg-slate-800/90 p-4 shadow-lg shadow-orange-950/20 flex flex-col justify-between"
                >
                  <div>
                    {/* Top ticket bar */}
                    <div className="flex items-start justify-between border-b border-slate-700/80 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-white">
                            {order.tableCode}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            #{order.orderNumber}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{order.tableLabel}</span>
                      </div>

                      <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${getTimerBadge(order.elapsedMinutes)}`}>
                        {order.elapsedMinutes}m elapsed
                      </span>
                    </div>

                    {/* Order line items */}
                    <div className="py-3 space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex items-baseline gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400 font-black text-sm">
                              {item.quantity}
                            </span>
                            <span className="font-extrabold text-white text-sm">
                              {item.itemName}
                            </span>
                          </div>

                          {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                            <div className="ml-8 flex flex-wrap gap-1">
                              {item.selectedModifiers.map((m) => (
                                <span
                                  key={m.id}
                                  className="rounded-md bg-slate-700/80 px-1.5 py-0.2 text-[10px] font-bold text-amber-300"
                                >
                                  +{m.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {item.notes && (
                            <p className="ml-8 text-xs italic text-amber-400/90">
                              Note: {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Special Instructions alert */}
                    {order.specialInstructions && (
                      <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-950/40 p-2.5 text-xs font-bold text-amber-300">
                        Kitchen Note: &ldquo;{order.specialInstructions}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Quick Action buttons */}
                  <div className="pt-3 border-t border-slate-700/80 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsCancelModalOpen(true);
                      }}
                      className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-900/50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsEtaModalOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 py-2.5 text-xs font-black text-white hover:bg-orange-500 shadow-md shadow-orange-600/30"
                    >
                      <Flame className="h-4 w-4" />
                      <span>Accept & Prep</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lane 2: IN PREPARATION */}
        <div className="flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 p-4 min-h-[600px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-white">
                In Preparation
              </h2>
            </div>
            <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-extrabold text-blue-400 border border-blue-500/30">
              {prepLane.length}
            </span>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {prepLane.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-600 text-center">
                <Flame className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-xs font-semibold">Nothing cooking right now</p>
              </div>
            ) : (
              prepLane.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    {/* Top line */}
                    <div className="flex items-start justify-between border-b border-slate-700/80 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-white">
                            {order.tableCode}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            #{order.orderNumber}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{order.tableLabel}</span>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${getTimerBadge(order.elapsedMinutes)}`}>
                          {order.elapsedMinutes}m elapsed
                        </span>
                        {order.chefEtaMinutes && (
                          <span className="text-[10px] font-bold text-orange-400">
                            Target: ~{order.chefEtaMinutes}m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Order line items */}
                    <div className="py-3 space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex items-baseline gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 font-black text-sm">
                              {item.quantity}
                            </span>
                            <span className="font-extrabold text-white text-sm">
                              {item.itemName}
                            </span>
                          </div>

                          {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                            <div className="ml-8 flex flex-wrap gap-1">
                              {item.selectedModifiers.map((m) => (
                                <span
                                  key={m.id}
                                  className="rounded-md bg-slate-700/80 px-1.5 py-0.2 text-[10px] font-bold text-amber-300"
                                >
                                  +{m.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {item.notes && (
                            <p className="ml-8 text-xs italic text-amber-400/90">
                              Note: {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {order.specialInstructions && (
                      <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-950/40 p-2.5 text-xs font-bold text-amber-300">
                        Kitchen Note: &ldquo;{order.specialInstructions}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Quick Action button: READY */}
                  <div className="pt-3 border-t border-slate-700/80 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsEtaModalOpen(true);
                      }}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
                    >
                      ETA
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusTransition(order.id, 'READY')}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/30"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Mark Ready</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lane 3: READY FOR SERVICE */}
        <div className="flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 p-4 min-h-[600px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-white">
                Ready for Pickup
              </h2>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-extrabold text-emerald-400 border border-emerald-500/30">
              {readyLane.length}
            </span>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {readyLane.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-600 text-center">
                <CheckCircle2 className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-xs font-semibold">No tickets waiting for pickup</p>
              </div>
            ) : (
              readyLane.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between border-b border-slate-700/80 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-white">
                            {order.tableCode}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            #{order.orderNumber}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-300">
                          {order.serviceMode === 'COUNTER_SERVICE' ? 'Counter Pickup' : 'Table Service'}
                        </span>
                      </div>

                      <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-black text-slate-950">
                        PLATED
                      </span>
                    </div>

                    <div className="py-3 space-y-1 text-xs text-slate-300">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="font-bold text-white">
                            {item.quantity}x {item.itemName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-700/80">
                    <p className="text-center text-xs font-bold text-emerald-400">
                      Waiting for Waiter / Guest Dispatch
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedOrder && isEtaModalOpen && (
        <SetEtaModal
          order={selectedOrder}
          onClose={() => {
            setIsEtaModalOpen(false);
            setSelectedOrder(null);
          }}
          onConfirm={handleSetEta}
        />
      )}

      {selectedOrder && isCancelModalOpen && (
        <CancelOrderModal
          order={selectedOrder}
          actionType="REJECT"
          onClose={() => {
            setIsCancelModalOpen(false);
            setSelectedOrder(null);
          }}
          onConfirm={handleCancel}
        />
      )}
    </div>
  );
}
