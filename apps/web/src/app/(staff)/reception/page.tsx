'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  ChefHat,
  Bell,
  ArrowRight,
  TrendingUp,
  Banknote,
  QrCode,
  Wallet,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import type {
  StaffOrderDto,
  OrderLifecycleStatus,
  StaffBillingQueueResponseDto,
} from '@restaurant-saas/contracts';
import OrderDetailModal from '../components/OrderDetailModal';
import SetEtaModal from '../components/SetEtaModal';
import CancelOrderModal from '../components/CancelOrderModal';

const STATUS_FILTERS = [
  { key: 'ALL', label: 'All Orders' },
  { key: 'PLACED', label: 'New / Placed' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PREPARING', label: 'In Kitchen' },
  { key: 'READY', label: 'Ready for Service' },
  { key: 'SERVED', label: 'Served' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled / Rejected' },
];

export default function ReceptionDashboardPage() {
  const [orders, setOrders] = useState<StaffOrderDto[]>([]);
  const [billingQueue, setBillingQueue] = useState<StaffBillingQueueResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [hasNewUnseenOrder, setHasNewUnseenOrder] = useState(false);

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<StaffOrderDto | null>(null);
  const [isEtaModalOpen, setIsEtaModalOpen] = useState(false);
  const [cancelModalAction, setCancelModalAction] = useState<'REJECT' | 'CANCEL' | null>(null);

  const loadOrders = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const [ordersRes, billingRes] = await Promise.allSettled([
        fetchWithAuth<StaffOrderDto[]>('/v1/staff/orders'),
        fetchWithAuth<StaffBillingQueueResponseDto>('/v1/staff/billing/queue'),
      ]);

      if (ordersRes.status === 'rejected') {
        throw ordersRes.reason;
      }

      const data = ordersRes.value;
      if (billingRes.status === 'fulfilled') {
        setBillingQueue(billingRes.value);
      }

      // Check if new PLACED orders arrived compared to previous state
      setOrders((prev) => {
        const prevPlacedIds = new Set(prev.filter((o) => o.status === 'PLACED').map((o) => o.id));
        const newPlaced = data.filter((o) => o.status === 'PLACED' && !prevPlacedIds.has(o.id));
        if (newPlaced.length > 0 && prev.length > 0) {
          setHasNewUnseenOrder(true);
        }
        return data;
      });

      setLastRefreshed(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch staff orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders(false);

    // 5-second resilient polling loop for high-frequency staff queue
    const interval = setInterval(() => {
      loadOrders(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleUpdateStatus = async (orderId: string, targetStatus: OrderLifecycleStatus, notes?: string) => {
    try {
      await fetchWithAuth(`/v1/staff/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus, notes }),
      });
      await loadOrders(true);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: targetStatus, settlementNotes: notes } : null));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const handleSetEta = async (etaMinutes: number, notes?: string) => {
    if (!selectedOrder) return;
    await fetchWithAuth(`/v1/staff/orders/${selectedOrder.id}/eta`, {
      method: 'PATCH',
      body: JSON.stringify({ chefEtaMinutes: etaMinutes, notes }),
    });
    await loadOrders(true);
    setSelectedOrder((prev) => (prev ? { ...prev, chefEtaMinutes: etaMinutes } : null));
  };

  const handleCancelOrReject = async (reason: string) => {
    if (!selectedOrder || !cancelModalAction) return;
    const targetStatus = cancelModalAction === 'REJECT' ? 'REJECTED' : 'CANCELLED';
    await fetchWithAuth(`/v1/staff/orders/${selectedOrder.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: targetStatus,
        [cancelModalAction === 'REJECT' ? 'rejectionReason' : 'cancellationReason']: reason,
      }),
    });
    await loadOrders(true);
    setSelectedOrder(null);
  };

  // Operational Metrics
  const placedCount = orders.filter((o) => o.status === 'PLACED').length;
  const preparingCount = orders.filter((o) => o.status === 'PREPARING' || o.status === 'ACCEPTED').length;
  const readyCount = orders.filter((o) => o.status === 'READY').length;
  const activeTotal = orders.filter(
    (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
  ).length;

  // Financial & Payment Tracking Metrics (Authoritative Phase E Billing + Orders)
  const nonCancelledOrders = orders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'REJECTED');
  const totalRevenueMinor = nonCancelledOrders.reduce((sum, o) => sum + o.totalMinor, 0);

  const completedRevenueMinor = billingQueue
    ? billingQueue.summary.totalSalesMinor
    : orders.filter((o) => o.status === 'COMPLETED').reduce((sum, o) => sum + o.totalMinor, 0);

  const cashCollectedMinor = billingQueue ? billingQueue.summary.cashCollectedMinor : 0;

  const upiCollectedMinor = billingQueue ? billingQueue.summary.upiCollectedMinor : 0;

  const pendingSettlementMinor = billingQueue
    ? billingQueue.sessions
        .filter((s) => s.bill?.status !== 'VERIFIED_PAID')
        .reduce((sum, s) => sum + (s.bill ? s.bill.totalMinor : s.estimatedTotalMinor), 0)
    : orders
        .filter((o) => o.status === 'SERVED' || o.status === 'READY' || o.status === 'PREPARING' || o.status === 'ACCEPTED' || o.status === 'PLACED')
        .reduce((sum, o) => sum + o.totalMinor, 0);

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    // Status filter
    if (activeFilter === 'CANCELLED') {
      if (order.status !== 'CANCELLED' && order.status !== 'REJECTED') return false;
    } else if (activeFilter !== 'ALL' && order.status !== activeFilter) {
      return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOrderNum = order.orderNumber.toLowerCase().includes(q);
      const matchTable = order.tableCode.toLowerCase().includes(q) || order.tableLabel.toLowerCase().includes(q);
      const matchItem = order.items.some((i) => i.itemName.toLowerCase().includes(q));
      if (!matchOrderNum && !matchTable && !matchItem) return false;
    }

    return true;
  });

  const getElapsedBadge = (minutes: number) => {
    if (minutes < 10) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (minutes < 20) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-red-100 text-red-800 border-red-300 animate-pulse';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / New Order Alert Beacon */}
      {hasNewUnseenOrder && (
        <div className="flex items-center justify-between rounded-2xl bg-orange-600 p-4 text-white shadow-lg shadow-orange-600/20 animate-bounce">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 animate-spin" />
            <div>
              <p className="font-extrabold text-sm">New Incoming Order Alert!</p>
              <p className="text-xs text-orange-100">
                A customer just placed a new order. Check the queue below.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setHasNewUnseenOrder(false);
              setActiveFilter('PLACED');
            }}
            className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-50"
          >
            View New Orders
          </button>
        </div>
      )}

      {/* Reception Revenue & Payment Collection Tracker */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Sales Today
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {nonCancelledOrders.length} orders
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">
              ₹{(totalRevenueMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Settled: ₹{(completedRevenueMinor / 100).toFixed(0)} &bull; Active: ₹{(pendingSettlementMinor / 100).toFixed(0)}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <Banknote className="h-4 w-4 text-emerald-600" />
              <span>Cash Collected</span>
            </span>
            <span className="rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-extrabold">
              CASH
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-700">
              ₹{(cashCollectedMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 mt-1">
            Verified cash received at reception counter
          </p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
              <QrCode className="h-4 w-4 text-purple-600" />
              <span>UPI Collected</span>
            </span>
            <span className="rounded-md bg-purple-100 text-purple-800 px-2 py-0.5 text-[10px] font-extrabold">
              UPI QR
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-purple-700">
              ₹{(upiCollectedMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-purple-600 mt-1">
            Verified bank UPI transfers
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>Pending Table Bills</span>
            </span>
            <span className="rounded-md bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-extrabold">
              UNSETTLED
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-700">
              ₹{(pendingSettlementMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-amber-600 mt-1">
            Active diners / tables awaiting billing
          </p>
        </div>
      </div>

      {/* Reception Operational KPI Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Active Orders
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{activeTotal}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              In progress
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 shadow-xs">
          <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">
            New / Placed
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-orange-700">{placedCount}</span>
            {placedCount > 0 && (
              <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                Action required
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
            In Kitchen
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-700">{preparingCount}</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              Cooking
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
            Ready for Delivery
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700">{readyCount}</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Pick up now
            </span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Status Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Horizontal Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={`rounded-xl px-3.5 py-2 transition whitespace-nowrap ${
                activeFilter === f.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
              {f.key === 'PLACED' && placedCount > 0 && (
                <span className="ml-1.5 rounded-full bg-orange-600 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {placedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search, Billing Link & Refresh */}
        <div className="flex items-center gap-2">
          <Link
            href="/staff/billing"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#EF5301] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#d94900] transition whitespace-nowrap"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>Billing &amp; Payments</span>
          </Link>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table, order, item..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <button
            type="button"
            onClick={() => loadOrders(false)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-orange-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-600 mb-2" />
          <p className="text-xs font-semibold">Loading live operational queue...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <ClipboardList className="h-12 w-12 text-slate-300 mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">No Orders Found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            {activeFilter !== 'ALL'
              ? `There are currently no orders in status "${activeFilter}".`
              : 'Waiting for customers to scan table QR codes and submit food orders.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className={`flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition hover:shadow-md ${
                order.status === 'PLACED'
                  ? 'border-orange-300 ring-2 ring-orange-200/50'
                  : 'border-slate-200'
              }`}
            >
              <div>
                {/* Order Card Top Line */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-base">
                        #{order.orderNumber}
                      </span>
                      <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-xs font-black text-white">
                        {order.tableCode}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {order.tableLabel} &bull; {order.serviceMode === 'COUNTER_SERVICE' ? 'Counter' : 'Dine-In'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                        order.status === 'PLACED'
                          ? 'bg-orange-100 text-orange-800'
                          : order.status === 'ACCEPTED'
                          ? 'bg-amber-100 text-amber-800'
                          : order.status === 'PREPARING'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'READY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.status === 'SERVED'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {order.status}
                    </span>
                    <span className={`rounded-full border px-2 py-0.2 text-[10px] font-bold ${getElapsedBadge(order.elapsedMinutes)}`}>
                      {order.elapsedMinutes}m ago
                    </span>
                  </div>
                </div>

                {/* Items Preview */}
                <div className="py-3 space-y-1.5">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <div className="flex items-baseline gap-1.5 pr-2">
                        <span className="font-bold text-slate-900">{item.quantity}x</span>
                        <span className="text-slate-800 font-medium">{item.itemName}</span>
                      </div>
                      <span className="text-slate-500 font-medium shrink-0">
                        ₹{(item.subtotalMinor / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Diner instructions alert if present */}
                {order.specialInstructions && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] font-semibold text-amber-900">
                    &ldquo;{order.specialInstructions}&rdquo;
                  </div>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Total</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    ₹{(order.totalMinor / 100).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100"
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>

                  {order.status === 'PLACED' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.id, 'ACCEPTED')}
                      className="rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700 shadow-xs"
                    >
                      Accept
                    </button>
                  )}

                  {order.status === 'ACCEPTED' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
                    >
                      To Kitchen
                    </button>
                  )}

                  {order.status === 'PREPARING' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.id, 'READY')}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                    >
                      Ready
                    </button>
                  )}

                  {order.status === 'READY' && order.serviceMode !== 'COUNTER_SERVICE' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.id, 'SERVED')}
                      className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs"
                    >
                      Serve
                    </button>
                  )}

                  {order.status === 'READY' && order.serviceMode === 'COUNTER_SERVICE' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                      className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs"
                    >
                      Complete
                    </button>
                  )}

                  {order.status === 'SERVED' && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                    >
                      Settle Bill
                    </button>
                  )}

                  {order.status === 'COMPLETED' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {order.settlementNotes?.includes('PAID_CASH') ? (
                        <>
                          <Banknote className="h-3 w-3 text-emerald-600" />
                          <span>Cash</span>
                        </>
                      ) : order.settlementNotes?.includes('PAID_UPI') ? (
                        <>
                          <QrCode className="h-3 w-3 text-purple-600" />
                          <span>UPI</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Settled</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={async (status) => {
            await handleUpdateStatus(selectedOrder.id, status);
          }}
          onOpenEtaModal={() => setIsEtaModalOpen(true)}
          onOpenCancelModal={(action) => setCancelModalAction(action)}
        />
      )}

      {selectedOrder && isEtaModalOpen && (
        <SetEtaModal
          order={selectedOrder}
          onClose={() => setIsEtaModalOpen(false)}
          onConfirm={handleSetEta}
        />
      )}

      {selectedOrder && cancelModalAction && (
        <CancelOrderModal
          order={selectedOrder}
          actionType={cancelModalAction}
          onClose={() => setCancelModalAction(null)}
          onConfirm={handleCancelOrReject}
        />
      )}
    </div>
  );
}
