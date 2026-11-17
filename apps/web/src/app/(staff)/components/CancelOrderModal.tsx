'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import type { StaffOrderDto } from '@restaurant-saas/contracts';

interface CancelOrderModalProps {
  order: StaffOrderDto;
  actionType: 'REJECT' | 'CANCEL';
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

const PRESET_REASONS = [
  'Kitchen out of stock / 86 item',
  'Customer requested cancellation',
  'Duplicate or test order placed in error',
  'Kitchen capacity / rush hour backlog',
  'Special instructions cannot be fulfilled',
  'Other reason',
];

export default function CancelOrderModal({
  order,
  actionType,
  onClose,
  onConfirm,
}: CancelOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason === 'Other reason' ? customReason.trim() : selectedReason;
    if (!finalReason) {
      setError('Please provide a specific reason for this action.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(finalReason);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update order.');
      setSubmitting(false);
    }
  };

  const isReject = actionType === 'REJECT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              {isReject ? 'Reject Incoming Order' : 'Cancel Order'}
            </h3>
            <p className="text-xs text-slate-500">
              Order #{order.orderNumber} &bull; Table {order.tableCode} ({order.tableLabel})
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Reason (Required)
            </label>
            <div className="space-y-2">
              {PRESET_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs font-medium transition ${
                    selectedReason === reason
                      ? 'border-red-500 bg-red-50/50 text-red-950 font-semibold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{reason}</span>
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500"
                  />
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other reason' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Specific explanation
              </label>
              <textarea
                rows={3}
                required
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Explain why this order is being cancelled..."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Keep Order
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isReject ? 'Confirm Rejection' : 'Confirm Cancellation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
