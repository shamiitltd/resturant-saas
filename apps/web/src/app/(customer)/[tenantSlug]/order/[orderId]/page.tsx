'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { publicFetch } from '@/lib/api';
import {
  Clock,
  CheckCircle2,
  ChefHat,
  UtensilsCrossed,
  ArrowRight,
  PlusCircle,
  Receipt,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { CustomerOrderResponseDto, TableSessionOrdersSummaryDto } from '@restaurant-saas/contracts';

const STATUS_STEPS = [
  { key: 'PLACED', label: 'Order Sent', description: 'Received by kitchen' },
  { key: 'ACCEPTED', label: 'Accepted', description: 'Queued for preparation' },
  { key: 'PREPARING', label: 'Preparing', description: 'Chef is cooking' },
  { key: 'READY', label: 'Ready', description: 'Plated & ready to serve' },
  { key: 'SERVED', label: 'Served', description: 'Enjoy your meal!' },
];

function getStatusStepIndex(status: string) {
  switch (status) {
    case 'PLACED':
      return 0;
    case 'ACCEPTED':
      return 1;
    case 'PREPARING':
      return 2;
    case 'READY':
      return 3;
    case 'SERVED':
    case 'COMPLETED':
      return 4;
    default:
      return 0;
  }
}

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<CustomerOrderResponseDto | null>(null);
  const [sessionSummary, setSessionSummary] = useState<TableSessionOrdersSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Function to load authoritative order state from NestJS API (SEC-AUTH-01: Session Credential Enforced)
  const loadOrderAndSession = async () => {
    try {
      let sessionToken: string | undefined;
      try {
        const stored = localStorage.getItem('saas_table_session');
        if (stored) {
          const session = JSON.parse(stored);
          sessionToken = session.sessionToken;
        }
      } catch {
        // ignore
      }

      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['x-session-token'] = sessionToken;
      }

      const orderData = await publicFetch<CustomerOrderResponseDto>(`/v1/customer/orders/${orderId}`, {
        headers,
      });
      setOrder(orderData);

      // Load session orders if session token exists
      if (sessionToken) {
        try {
          const summary = await publicFetch<TableSessionOrdersSummaryDto>(
            `/v1/customer/sessions/${sessionToken}/orders`
          );
          setSessionSummary(summary);
        } catch {
          // Non-fatal if session summary fails
        }
      }

      setLastRefreshedAt(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to load order status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;

    loadOrderAndSession();

    // SEC-RT-01: Authoritative live tracking via 5-second polling interval
    // Guarantees reconnect recovery, session isolation, and privacy without relying on unauthenticated WebSockets
    const pollInterval = setInterval(() => {
      loadOrderAndSession();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        <h2 className="mt-4 font-bold text-slate-800 text-lg">Retrieving Order Status...</h2>
        <p className="mt-1 text-sm text-slate-500">Connecting to restaurant live tracking</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="mt-3 font-bold text-slate-900 text-lg">Order Not Found</h2>
        <p className="mt-1 text-sm text-slate-600">{error || 'Unable to locate order records'}</p>
        <button
          onClick={() => router.push(`/${tenantSlug}/menu`)}
          className="mt-4 rounded-xl bg-orange-600 px-4 py-2 font-semibold text-sm text-white hover:bg-orange-700"
        >
          Return to Menu
        </button>
      </div>
    );
  }

  const currentStep = getStatusStepIndex(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 pb-20">
      {/* Table & Order Header */}
      <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-xs mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 uppercase tracking-wider">
              <ChefHat className="h-4 w-4" />
              <span>Live Kitchen Tracker</span>
            </div>
            <h1 className="font-extrabold text-slate-900 text-xl mt-0.5">
              Order #{order.orderNumber}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {order.tableLabel} ({order.tableCode})
            </p>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 font-extrabold text-orange-800 text-xs">
              {order.status}
            </span>
            <p className="text-[10px] text-slate-400 mt-1">
              Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Chef ETA Banner */}
        {order.chefEtaMinutes && order.status !== 'SERVED' && order.status !== 'COMPLETED' && order.status !== 'REJECTED' && order.status !== 'CANCELLED' && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50/70 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-white">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="block font-bold text-orange-950 text-xs">Estimated Prep Time</span>
              <span className="block font-extrabold text-orange-800 text-sm">
                ~{order.chefEtaMinutes} minutes until ready
              </span>
            </div>
          </div>
        )}

        {/* Rejection / Cancellation Banner */}
        {(order.status === 'REJECTED' || order.status === 'CANCELLED') && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
              <AlertCircle className="h-5 w-5" />
              <span>Order {order.status === 'REJECTED' ? 'Rejected' : 'Cancelled'}</span>
            </div>
            {(order.rejectionReason || order.cancellationReason) && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                Reason: {order.rejectionReason || order.cancellationReason}
              </p>
            )}
            <p className="mt-2 text-[11px] text-red-500">
              Please contact restaurant staff or place a new order from the menu.
            </p>
          </div>
        )}
      </div>

      {/* Visual Status Stepper */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs mb-5">
        <h2 className="font-bold text-slate-900 text-sm mb-4">Kitchen Progress</h2>

        <div className="relative">
          {/* Progress bar line */}
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />
          <div
            className="absolute left-4 top-4 w-0.5 bg-orange-600 transition-all duration-500"
            style={{
              height: `${(Math.min(currentStep, STATUS_STEPS.length - 1) / (STATUS_STEPS.length - 1)) * 100}%`,
            }}
          />

          <div className="space-y-6">
            {STATUS_STEPS.map((step, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;

              return (
                <div key={step.key} className="relative flex items-start gap-4">
                  {/* Step circle */}
                  <div
                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
                      isPast
                        ? 'border-orange-600 bg-orange-600 text-white'
                        : isCurrent
                        ? 'border-orange-600 bg-white text-orange-600 ring-4 ring-orange-100'
                        : 'border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-bold">{idx + 1}</span>
                    )}
                  </div>

                  <div className="pt-0.5">
                    <span
                      className={`block text-sm font-bold ${
                        isCurrent ? 'text-orange-900' : isPast ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="block text-xs text-slate-500">{step.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ordered Items Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden mb-5">
        <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-bold text-slate-900 text-sm">Items in this Order</h2>
          <span className="text-xs font-extrabold text-slate-900">
            ₹{(order.totalMinor / 100).toFixed(2)}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {order.items.map((item, i) => (
            <div key={i} className="p-4 flex justify-between items-start">
              <div>
                <span className="font-bold text-slate-900 text-sm">
                  {item.quantity}x {item.itemName}
                </span>

                {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {item.selectedModifiers.map((m) => (
                      <span
                        key={m.id}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-medium"
                      >
                        {m.name}
                      </span>
                    ))}
                  </div>
                )}

                {item.notes && (
                  <p className="mt-1 text-xs italic text-slate-500">Note: {item.notes}</p>
                )}
              </div>

              <span className="font-bold text-slate-900 text-sm">
                ₹{(item.subtotalMinor / 100).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ADR-003 Consolidated Session Orders (Multiple orders per table) */}
      {sessionSummary && sessionSummary.orders.length > 1 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-4 w-4 text-amber-700" />
            <h3 className="font-bold text-amber-950 text-sm">Consolidated Table Session</h3>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            {sessionSummary.orders.length} orders submitted for this table. All orders are grouped onto one bill.
          </p>

          <div className="space-y-1.5 text-xs text-amber-950">
            {sessionSummary.orders.map((o) => (
              <div key={o.orderId} className="flex justify-between items-center py-1 border-b border-amber-200/50">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{o.orderNumber}</span>
                  <span className="rounded-full bg-amber-200/80 px-2 py-0.2 text-[10px] font-bold">
                    {o.status}
                  </span>
                </div>
                <span className="font-bold">₹{(o.totalMinor / 100).toFixed(2)}</span>
              </div>
            ))}

            <div className="flex justify-between items-baseline pt-2 font-extrabold text-sm text-amber-950">
              <span>Consolidated Session Bill</span>
              <span className="text-base text-amber-900">
                ₹{(sessionSummary.consolidatedTotalMinor / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Order More CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/${tenantSlug}/menu`}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-orange-600 py-3.5 font-bold text-white shadow-md shadow-orange-200 transition hover:bg-orange-700"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Add More Dishes to Table</span>
        </Link>
      </div>
    </div>
  );
}
