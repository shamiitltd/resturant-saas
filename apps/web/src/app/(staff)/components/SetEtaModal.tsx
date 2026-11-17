'use client';

import React, { useState } from 'react';
import { X, Clock, Loader2, AlertCircle } from 'lucide-react';
import type { StaffOrderDto } from '@restaurant-saas/contracts';

interface SetEtaModalProps {
  order: StaffOrderDto;
  onClose: () => void;
  onConfirm: (etaMinutes: number, notes?: string) => Promise<void>;
}

const PRESET_ETAS = [10, 15, 20, 25, 30, 45];

export default function SetEtaModal({ order, onClose, onConfirm }: SetEtaModalProps) {
  const [selectedEta, setSelectedEta] = useState<number>(order.chefEtaMinutes || 15);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEta < 1 || selectedEta > 180) {
      setError('Prep time must be between 1 and 180 minutes.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(selectedEta, notes.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update prep time.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Estimated Kitchen Prep Time</h3>
            <p className="text-xs text-slate-500">
              Order #{order.orderNumber} &bull; Table {order.tableCode}
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
              Quick Pick (Minutes)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_ETAS.map((mins) => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => setSelectedEta(mins)}
                  className={`rounded-xl border py-2.5 text-xs font-bold transition ${
                    selectedEta === mins
                      ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-xs'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {mins} mins
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custom Minutes (1 - 180)
            </label>
            <input
              type="number"
              min={1}
              max={180}
              value={selectedEta}
              onChange={(e) => setSelectedEta(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kitchen Note (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Well done takes extra 5m"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Save Prep Time</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
