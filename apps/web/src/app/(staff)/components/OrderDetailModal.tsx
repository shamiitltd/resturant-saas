'use client';

import React from 'react';
import {
  X,
  Clock,
  ChefHat,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  User,
  ShoppingBag,
  Banknote,
  QrCode,
} from 'lucide-react';
import type { StaffOrderDto } from '@restaurant-saas/contracts';

interface OrderDetailModalProps {
  order: StaffOrderDto;
  onClose: () => void;
  onUpdateStatus: (status: any, notes?: string) => Promise<void>;
  onOpenEtaModal: () => void;
  onOpenCancelModal: (action: 'REJECT' | 'CANCEL') => void;
}

export default function OrderDetailModal({
  order,
  onClose,
  onUpdateStatus,
  onOpenEtaModal,
  onOpenCancelModal,
}: OrderDetailModalProps) {
  const [isUpiInputOpen, setIsUpiInputOpen] = React.useState(false);
  const [upiRef, setUpiRef] = React.useState('');
  const getElapsedBadge = (minutes: number) => {
    if (minutes < 10) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (minutes < 20) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    return 'bg-red-100 text-red-800 border-red-300 animate-pulse';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Order #{order.orderNumber}
                </h3>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                  {order.tableCode} ({order.tableLabel})
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Placed at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Status & Timing Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">Status:</span>
              <span className="rounded-full bg-orange-600 px-2.5 py-0.5 font-bold text-white">
                {order.status}
              </span>
              <span className={`rounded-full border px-2 py-0.5 font-bold ${getElapsedBadge(order.elapsedMinutes)}`}>
                {order.elapsedMinutes}m ago
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">Mode:</span>
              <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-medium text-slate-700">
                {order.serviceMode === 'COUNTER_SERVICE' ? 'Counter Pickup' : 'Table Service'}
              </span>
            </div>
          </div>

          {/* Prep ETA Callout */}
          {order.chefEtaMinutes && (
            <div className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50/60 p-3 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="font-bold text-orange-950">
                  Target Prep Time: ~{order.chefEtaMinutes} mins
                </span>
              </div>
              {order.status !== 'SERVED' && order.status !== 'COMPLETED' && (
                <button
                  type="button"
                  onClick={onOpenEtaModal}
                  className="font-bold text-orange-700 hover:underline"
                >
                  Adjust ETA
                </button>
              )}
            </div>
          )}

          {/* Special Instructions */}
          {order.specialInstructions && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <span className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                Special Instructions from Diner
              </span>
              <p className="mt-0.5 text-xs font-semibold text-amber-950">
                &ldquo;{order.specialInstructions}&rdquo;
              </p>
            </div>
          )}

          {/* Rejection / Cancellation note if applicable */}
          {(order.rejectionReason || order.cancellationReason) && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <span className="font-bold">Reason for {order.status}: </span>
              <span>{order.rejectionReason || order.cancellationReason}</span>
            </div>
          )}

          {/* Payment & Settlement Note */}
          {order.settlementNotes && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-950 uppercase tracking-wider text-[10px]">
                  Payment Verified
                </span>
                <p className="font-semibold text-emerald-900 mt-0.5">{order.settlementNotes}</p>
              </div>
              <span className="rounded-md bg-emerald-600 text-white px-2 py-0.5 font-black text-[10px]">
                SETTLED
              </span>
            </div>
          )}

          {/* Line Items List */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Items Ordered ({order.items.reduce((acc, i) => acc + i.quantity, 0)})
            </h4>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-white flex justify-between items-start">
                  <div className="space-y-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-xs font-extrabold text-slate-800">
                        {item.quantity}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {item.itemName}
                      </span>
                    </div>

                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                      <div className="ml-7 flex flex-wrap gap-1 pt-0.5">
                        {item.selectedModifiers.map((mod) => (
                          <span
                            key={mod.id}
                            className="rounded-md bg-orange-50 border border-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-900"
                          >
                            +{mod.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.notes && (
                      <p className="ml-7 text-xs italic text-slate-500">Note: {item.notes}</p>
                    )}
                  </div>

                  <span className="font-bold text-slate-900 text-sm">
                    ₹{(item.subtotalMinor / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold">₹{(order.subtotalMinor / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span className="font-semibold">₹{(order.taxMinor / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 font-extrabold text-slate-900 text-sm">
              <span>Total Amount</span>
              <span className="text-orange-600">₹{(order.totalMinor / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="border-t border-slate-100 p-4 bg-slate-50 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {order.status === 'PLACED' && (
              <button
                type="button"
                onClick={() => onOpenCancelModal('REJECT')}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
              >
                Reject Order
              </button>
            )}

            {(order.status === 'ACCEPTED' || order.status === 'PREPARING') && (
              <button
                type="button"
                onClick={() => onOpenCancelModal('CANCEL')}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
              >
                Cancel Order
              </button>
            )}

            {order.status !== 'COMPLETED' && order.status !== 'REJECTED' && order.status !== 'CANCELLED' && (
              <button
                type="button"
                onClick={onOpenEtaModal}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Set / Edit ETA
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {order.status === 'PLACED' && (
              <button
                type="button"
                onClick={() => onUpdateStatus('ACCEPTED')}
                className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 shadow-sm"
              >
                Accept Order
              </button>
            )}

            {order.status === 'ACCEPTED' && (
              <button
                type="button"
                onClick={() => onUpdateStatus('PREPARING')}
                className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 shadow-sm"
              >
                Start Preparing
              </button>
            )}

            {order.status === 'PREPARING' && (
              <button
                type="button"
                onClick={() => onUpdateStatus('READY')}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
              >
                Mark as Ready
              </button>
            )}

            {order.status === 'READY' && order.serviceMode !== 'COUNTER_SERVICE' && (
              <button
                type="button"
                onClick={() => onUpdateStatus('SERVED')}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
              >
                Mark as Served
              </button>
            )}

            {order.status === 'READY' && order.serviceMode === 'COUNTER_SERVICE' && (
              <button
                type="button"
                onClick={() => onUpdateStatus('COMPLETED')}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-sm"
              >
                Customer Picked Up (Complete)
              </button>
            )}

            {order.status === 'SERVED' && (
              <div className="flex flex-wrap items-center gap-2">
                {!isUpiInputOpen ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus('COMPLETED', 'PAID_CASH: Cash received at counter')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                    >
                      <Banknote className="h-4 w-4" />
                      <span>Collect Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUpiInputOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-sm"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>Verify UPI QR</span>
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="UPI Ref / UTR (optional)"
                      value={upiRef}
                      onChange={(e) => setUpiRef(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateStatus('COMPLETED', `PAID_UPI: ${upiRef.trim() || 'Verified'}`)}
                      className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 shadow-sm"
                    >
                      Confirm UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUpiInputOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-700 px-1"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
