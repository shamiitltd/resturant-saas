'use client';

import React, { useState } from 'react';
import { X, Printer, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import type { RestaurantBillDto } from '@restaurant-saas/contracts';

interface InvoicePreviewModalProps {
  bill: RestaurantBillDto;
  onClose: () => void;
}

export function InvoicePreviewModal({ bill, onClose }: InvoicePreviewModalProps) {
  const [format, setFormat] = useState<'THERMAL' | 'A4'>('THERMAL');

  const formatMoney = (minor: number) =>
    `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-preview-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 print:hidden">
          <div className="flex items-center gap-3">
            <h2 id="invoice-preview-title" className="text-base font-bold text-slate-900">
              Invoice Preview
            </h2>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormat('THERMAL')}
                className={`rounded-md px-2.5 py-1 transition ${
                  format === 'THERMAL'
                    ? 'bg-white text-[#EF5301] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Thermal (80mm)
              </button>
              <button
                type="button"
                onClick={() => setFormat('A4')}
                className={`rounded-md px-2.5 py-1 transition ${
                  format === 'A4'
                    ? 'bg-white text-[#EF5301] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A4 Sheet
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close invoice preview"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-6 flex justify-center print:bg-white print:p-0">
          <div
            className={`bg-white border border-slate-200 shadow-sm p-6 text-slate-900 print:border-0 print:shadow-none ${
              format === 'THERMAL' ? 'w-[320px] font-mono text-xs' : 'w-full max-w-[580px] text-sm'
            }`}
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-4">
              <p className="text-base font-black tracking-tight">{bill.tenantName || 'Restaurant'}</p>
              <p className="text-xs text-slate-600 mt-0.5">{bill.locationName || 'Main Branch'}</p>
              <p className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Dine-In Consolidated Invoice
              </p>
            </div>

            <div className="mt-3 space-y-1 border-b border-dashed border-slate-300 pb-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice No:</span>
                <span className="font-bold">{bill.billNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Table:</span>
                <span className="font-bold">
                  {bill.tableCode || 'Walk-In'} {bill.tableLabel ? `(${bill.tableLabel})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Orders Grouped:</span>
                <span className="font-semibold">
                  {bill.orders.map((o) => o.orderNumber).join(', ') || '1'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Time:</span>
                <span>{new Date(bill.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Itemized Lines */}
            <div className="mt-3 border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between font-bold text-[11px] text-slate-500 uppercase pb-1.5">
                <span className="flex-1">Item</span>
                <span className="w-10 text-center">Qty</span>
                <span className="w-20 text-right">Amount</span>
              </div>
              <div className="space-y-2">
                {bill.lines.map((line) => (
                  <div key={line.id} className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 leading-tight">
                        {line.itemNameSnapshot}
                      </div>
                      {line.selectedModifiers && line.selectedModifiers.length > 0 && (
                        <div className="text-[10px] text-slate-500">
                          + {line.selectedModifiers.map((m) => m.name).join(', ')}
                        </div>
                      )}
                    </div>
                    <span className="w-10 text-center text-slate-700">{line.quantity}</span>
                    <span className="w-20 text-right font-semibold">
                      {formatMoney(line.lineTotalMinor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="mt-3 space-y-1.5 border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({bill.lines.reduce((s, l) => s + l.quantity, 0)} items)</span>
                <span>{formatMoney(bill.subtotalMinor)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>
                  {bill.taxRatePercent !== null
                    ? `Tax (GST ${bill.taxRatePercent}%)`
                    : 'Tax (Not Configured)'}
                </span>
                <span>{formatMoney(bill.taxMinor)}</span>
              </div>
              {bill.discountMinor > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span>-{formatMoney(bill.discountMinor)}</span>
                </div>
              )}
              <div className="flex justify-between items-center rounded-lg bg-slate-100 px-2.5 py-2 text-sm font-black text-slate-900">
                <span>Grand Total</span>
                <span>{formatMoney(bill.totalMinor)}</span>
              </div>
            </div>

            {/* Payment Verification Status */}
            <div className="mt-3 text-center">
              {bill.status === 'VERIFIED_PAID' ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>VERIFIED PAID</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{bill.status === 'PAYMENT_REPORTED' ? 'PAYMENT REPORTED — UNVERIFIED' : 'UNPAID'}</span>
                </div>
              )}
              <p className="mt-2 text-[10px] text-slate-400">
                Thank you for dining with {bill.tenantName || 'us'}!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3.5 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-[#EF5301] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#d94900] transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>
    </div>
  );
}
