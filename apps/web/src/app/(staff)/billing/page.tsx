'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  QrCode,
  CreditCard,
  Banknote,
  Wallet,
  Printer,
  ShieldCheck,
  XCircle,
  FileText,
  Layers,
  Ban,
  Settings,
  Loader2,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { UpiQrCode } from '@/components/UpiQrCode';
import { InvoicePreviewModal } from '../components/InvoicePreviewModal';
import type {
  StaffBillingQueueResponseDto,
  BillingQueueSessionDto,
  RestaurantBillDto,
  RestaurantPaymentMethod,
} from '@restaurant-saas/contracts';

type QueueTab = 'ACTIVE' | 'REPORTED' | 'PAID';

const PAYMENT_METHODS: Array<{
  value: RestaurantPaymentMethod;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'RESTAURANT_UPI_QR', label: 'UPI / QR', sublabel: 'Restaurant direct UPI', icon: QrCode },
  { value: 'CARD', label: 'Card', sublabel: 'Debit / Credit POS', icon: CreditCard },
  { value: 'CASH', label: 'Cash', sublabel: 'Counter cash drawer', icon: Banknote },
  { value: 'OTHER', label: 'Other', sublabel: 'Wallet / Store credit', icon: Wallet },
];

export default function StaffBillingPage() {
  const [queueData, setQueueData] = useState<StaffBillingQueueResponseDto | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<QueueTab>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Payment & Billing Form State
  const [selectedMethod, setSelectedMethod] = useState<RestaurantPaymentMethod>('RESTAURANT_UPI_QR');
  const [billNotes, setBillNotes] = useState('');
  const [paymentRefInput, setPaymentRefInput] = useState('');
  const [printAfterConfirm, setPrintAfterConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [previewBill, setPreviewBill] = useState<RestaurantBillDto | null>(null);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const formatMoney = (minor: number) =>
    `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const loadQueue = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await fetchWithAuth<StaffBillingQueueResponseDto>('/v1/staff/billing/queue');
      setQueueData(data);
      setError(null);
      setPermissionDenied(false);

      setSelectedSessionId((prev) => {
        if (prev && data.sessions.some((s) => s.tableSessionId === prev)) {
          return prev;
        }
        return data.sessions[0]?.tableSessionId || null;
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to load billing queue';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('forbidden')) {
        setPermissionDenied(true);
      }
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadQueue(false);
    const interval = setInterval(() => loadQueue(true), 6000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const filteredSessions = useMemo(() => {
    if (!queueData) return [];
    const q = searchQuery.trim().toLowerCase();

    return queueData.sessions.filter((s) => {
      const billStatus = s.bill?.status;
      if (activeTab === 'ACTIVE') {
        if (billStatus === 'VERIFIED_PAID') return false;
      } else if (activeTab === 'REPORTED') {
        if (billStatus !== 'PAYMENT_REPORTED') return false;
      } else if (activeTab === 'PAID') {
        if (billStatus !== 'VERIFIED_PAID') return false;
      }

      if (!q) return true;
      const matchesTable =
        s.tableCode.toLowerCase().includes(q) || s.tableLabel.toLowerCase().includes(q);
      const matchesBill = s.bill?.billNumber.toLowerCase().includes(q);
      const matchesOrder = s.orders.some((o) => o.orderNumber.toLowerCase().includes(q));
      return Boolean(matchesTable || matchesBill || matchesOrder);
    });
  }, [queueData, activeTab, searchQuery]);

  const selectedSession: BillingQueueSessionDto | null = useMemo(() => {
    if (!queueData) return null;
    return (
      queueData.sessions.find((s) => s.tableSessionId === selectedSessionId) ||
      filteredSessions[0] ||
      null
    );
  }, [queueData, selectedSessionId, filteredSessions]);

  const activeBill = selectedSession?.bill || null;
  const reportedPayment = useMemo(
    () => activeBill?.payments.find((p) => p.status === 'PAYMENT_REPORTED') || null,
    [activeBill]
  );

  // Sync bill notes when switching selected session
  useEffect(() => {
    setBillNotes(selectedSession?.bill?.notes || '');
    setPaymentRefInput('');
  }, [selectedSession?.tableSessionId, selectedSession?.bill?.notes]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleGenerateBill = async (recalculate = true) => {
    if (!selectedSession) return;
    setSubmitting(true);
    try {
      const bill = await fetchWithAuth<RestaurantBillDto>(
        `/v1/staff/table-sessions/${selectedSession.tableSessionId}/bills`,
        {
          method: 'POST',
          body: JSON.stringify({
            notes: billNotes.trim() || undefined,
            recalculate,
          }),
        }
      );
      await loadQueue(true);
      showToast('success', `Consolidated bill ${bill.billNumber} ready.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to generate consolidated bill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDirectPayment = async () => {
    if (!selectedSession) return;
    setSubmitting(true);
    try {
      // Ensure consolidated bill exists first
      let targetBill = activeBill;
      if (!targetBill) {
        targetBill = await fetchWithAuth<RestaurantBillDto>(
          `/v1/staff/table-sessions/${selectedSession.tableSessionId}/bills`,
          {
            method: 'POST',
            body: JSON.stringify({ notes: billNotes.trim() || undefined, recalculate: true }),
          }
        );
      }

      const idempotencyKey = `staff-pay-${targetBill.id}-${Date.now()}`;
      const updated = await fetchWithAuth<RestaurantBillDto>(
        `/v1/staff/bills/${targetBill.id}/payments`,
        {
          method: 'POST',
          body: JSON.stringify({
            method: selectedMethod,
            customerReference: paymentRefInput.trim() || undefined,
            notes: billNotes.trim() || undefined,
            idempotencyKey,
            verifyImmediately: true,
          }),
        }
      );

      await loadQueue(true);
      showToast('success', `Payment verified and bill ${updated.billNumber} marked Paid.`);
      if (printAfterConfirm) {
        setPreviewBill(updated);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to confirm payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyReportedPayment = async (approved: boolean) => {
    if (!reportedPayment) return;
    setSubmitting(true);
    try {
      const updated = await fetchWithAuth<RestaurantBillDto>(
        `/v1/staff/payments/${reportedPayment.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({
            approved,
            customerReference: paymentRefInput.trim() || undefined,
            notes: approved
              ? 'Verified in restaurant UPI / bank channel'
              : 'Payment not received in restaurant UPI / bank channel',
          }),
        }
      );
      await loadQueue(true);
      showToast(
        approved ? 'success' : 'error',
        approved
          ? `Payment verified for ${updated.billNumber}.`
          : `Claimed payment marked Not Received. Bill returned to Unpaid.`
      );
      if (approved && printAfterConfirm) {
        setPreviewBill(updated);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update payment verification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBill || !voidReason.trim()) return;
    setSubmitting(true);
    try {
      await fetchWithAuth<RestaurantBillDto>(`/v1/staff/bills/${activeBill.id}/void`, {
        method: 'POST',
        body: JSON.stringify({ voidReason: voidReason.trim() }),
      });
      setVoidModalOpen(false);
      setVoidReason('');
      await loadQueue(true);
      showToast('success', `Bill ${activeBill.billNumber} has been voided.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to void bill');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#EF5301]" />
          <p className="text-sm font-medium">Loading Billing &amp; Invoices...</p>
        </div>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
        <ShieldCheck className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">Billing Access Restricted</h1>
        <p className="mt-1 text-sm text-slate-600">
          {error || 'Your role does not have permission to view or verify branch bills.'}
        </p>
        <Link
          href="/staff/kitchen"
          className="mt-5 inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
        >
          Return to Assigned Station
        </Link>
      </div>
    );
  }

  const summary = queueData?.summary;
  const paymentSettings = queueData?.paymentSettings;

  // Stepper index for 02-staff/19-payment-verification-invoice-printing.png
  const verificationStep =
    activeBill?.status === 'VERIFIED_PAID'
      ? 3
      : activeBill?.status === 'PAYMENT_REPORTED'
      ? 2
      : 1;

  return (
    <div className="space-y-5">
      {/* Feedback Toast */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header + Top KPI Cards (matching 02-staff/05-billing-invoices.png) */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 border border-orange-100 text-[#EF5301]">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Billing &amp; Invoices
            </h1>
            <p className="text-xs text-slate-500">
              Generate consolidated table bills, verify restaurant UPI/cash payments, and print invoices.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#EF5301]">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900">{summary?.billsToday ?? 0}</div>
              <div className="text-[11px] text-slate-500 font-medium">Bills Paid Today</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Banknote className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900">
                {formatMoney(summary?.totalSalesMinor ?? 0)}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Verified Sales</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <QrCode className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900">
                {formatMoney(summary?.avgBillMinor ?? 0)}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Avg. Bill Value</div>
            </div>
          </div>
        </div>
      </div>

      {/* Error State Banner */}
      {error && !permissionDenied && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadQueue(false)}
            className="rounded-lg bg-red-600 px-3 py-1 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3-Column Billing Workspace (matching 02-staff/05, 15, 16, 19) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Sessions & Bills Queue */}
        <section
          aria-label="Table sessions queue"
          className="lg:col-span-4 xl:col-span-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3.5"
        >
          {/* Queue Tabs */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('ACTIVE')}
              className={`rounded-lg py-1.5 px-2 transition ${
                activeTab === 'ACTIVE'
                  ? 'bg-[#EF5301] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({summary?.pendingBillsCount ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('REPORTED')}
              className={`rounded-lg py-1.5 px-2 transition flex items-center justify-center gap-1 ${
                activeTab === 'REPORTED'
                  ? 'bg-[#EF5301] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Verify</span>
              {(summary?.reportedCount ?? 0) > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    activeTab === 'REPORTED'
                      ? 'bg-white text-[#EF5301]'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {summary?.reportedCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PAID')}
              className={`rounded-lg py-1.5 px-2 transition ${
                activeTab === 'PAID'
                  ? 'bg-[#EF5301] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paid
            </button>
          </div>

          {/* Search & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search table, bill #, order #..."
                aria-label="Search table sessions"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#EF5301] focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => loadQueue(true)}
              title="Refresh queue"
              aria-label="Refresh billing queue"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-[#EF5301]' : ''}`} />
            </button>
          </div>

          {/* Session Cards */}
          <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
            {filteredSessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 px-4 text-center">
                <Receipt className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  No table sessions in this view
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Orders placed at tables will appear here for consolidated billing.
                </p>
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isSelected = selectedSession?.tableSessionId === session.tableSessionId;
                const bill = session.bill;
                const displayTotal = bill ? bill.totalMinor : session.estimatedTotalMinor;

                const statusBadge =
                  bill?.status === 'VERIFIED_PAID'
                    ? { label: 'Verified Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                    : bill?.status === 'PAYMENT_REPORTED'
                    ? { label: 'Payment Reported', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
                    : bill?.status === 'UNPAID'
                    ? { label: 'Bill Unpaid', cls: 'bg-amber-50 text-amber-800 border-amber-200' }
                    : { label: 'Pending Bill', cls: 'bg-orange-50 text-[#EF5301] border-orange-200' };

                return (
                  <button
                    key={session.tableSessionId}
                    type="button"
                    onClick={() => setSelectedSessionId(session.tableSessionId)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      isSelected
                        ? 'border-[#EF5301] bg-orange-50/40 ring-1 ring-[#EF5301]/30'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                            isSelected
                              ? 'bg-[#EF5301] text-white'
                              : 'bg-orange-50 text-[#EF5301]'
                          }`}
                        >
                          {session.tableCode}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate">
                            {bill ? bill.billNumber : session.tableLabel}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {session.ordersCount} {session.ordersCount === 1 ? 'order' : 'orders'} &bull;{' '}
                            {session.itemsCount} items
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-slate-900">
                          {formatMoney(displayTotal)}
                        </div>
                        <span
                          className={`mt-1 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${statusBadge.cls}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* CENTER COLUMN: Table Session Multi-Order Consolidated Breakdown */}
        <section
          aria-label="Consolidated session orders breakdown"
          className="lg:col-span-8 xl:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
        >
          {!selectedSession ? (
            <div className="py-16 text-center">
              <Layers className="mx-auto h-10 w-10 text-slate-300" />
              <h2 className="mt-3 text-sm font-bold text-slate-700">Select a Table Session</h2>
              <p className="mt-1 text-xs text-slate-500">
                Choose an active or billed session on the left to review orders and settle payment.
              </p>
            </div>
          ) : (
            <>
              {/* Session Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-slate-900">
                      {activeBill ? activeBill.billNumber : `Table ${selectedSession.tableCode}`}
                    </h2>
                    <span className="rounded-lg bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-[#EF5301]">
                      Table: {selectedSession.tableCode}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        selectedSession.sessionStatus === 'OPEN'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Session {selectedSession.sessionStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedSession.tableLabel} &bull; Started{' '}
                    {new Date(selectedSession.openedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    &bull; {selectedSession.ordersCount} KOT(s) grouped on consolidated bill
                  </p>
                </div>

                {activeBill && (
                  <button
                    type="button"
                    onClick={() => setPreviewBill(activeBill)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Invoice Preview</span>
                  </button>
                )}
              </div>

              {/* Stacked Orders in this Table Session (ADR-003 / 02-staff/15-table-session-multiple-orders.png) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Orders in this Session ({selectedSession.orders.length})
                  </h3>
                  {activeBill && activeBill.status !== 'VERIFIED_PAID' && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleGenerateBill(true)}
                      className="text-xs font-bold text-[#EF5301] hover:underline disabled:opacity-50"
                    >
                      Recalculate Bill
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
                  {selectedSession.orders.map((order, idx) => (
                    <div
                      key={order.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3.5 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-900">
                            Order #{idx + 1} &bull; {order.orderNumber}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {order.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-200/70 px-3.5">
                        {order.items.map((item, itemIdx) => (
                          <div
                            key={`${order.id}-${itemIdx}`}
                            className="flex items-start justify-between py-2 text-xs"
                          >
                            <div className="min-w-0 pr-3">
                              <div className="font-semibold text-slate-900">
                                {item.quantity}x {item.itemName}
                              </div>
                              {item.selectedModifiers.length > 0 && (
                                <div className="text-[11px] text-slate-500">
                                  {item.selectedModifiers.map((m) => m.name).join(', ')}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0 font-bold text-slate-800">
                              {formatMoney(item.subtotalMinor)}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200 bg-white/80 px-3.5 py-2 text-xs font-bold text-slate-700">
                        <span>{order.orderNumber} Subtotal</span>
                        <span>{formatMoney(order.totalMinor)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Consolidated Totals */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal ({selectedSession.itemsCount} items)</span>
                  <span className="font-semibold">
                    {formatMoney(activeBill ? activeBill.subtotalMinor : selectedSession.estimatedSubtotalMinor)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    {(activeBill ? activeBill.taxRatePercent : selectedSession.taxRatePercent) !== null
                      ? `Tax (GST ${activeBill ? activeBill.taxRatePercent : selectedSession.taxRatePercent}%)`
                      : 'Tax (Not Configured — 0%)'}
                  </span>
                  <span className="font-semibold">
                    {formatMoney(activeBill ? activeBill.taxMinor : selectedSession.estimatedTaxMinor)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline border-t border-slate-200 pt-2.5">
                  <span className="text-sm font-extrabold text-slate-900">Consolidated Total</span>
                  <span className="text-xl font-black text-[#EF5301]">
                    {formatMoney(activeBill ? activeBill.totalMinor : selectedSession.estimatedTotalMinor)}
                  </span>
                </div>
              </div>

              {/* Optional Bill Notes */}
              <div>
                <label
                  htmlFor="bill-notes-input"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Bill Notes (optional)
                </label>
                <input
                  id="bill-notes-input"
                  type="text"
                  value={billNotes}
                  disabled={activeBill?.status === 'VERIFIED_PAID'}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="e.g. Birthday dinner, customer requested invoice copy"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#EF5301] focus:outline-none disabled:bg-slate-100"
                />
              </div>
            </>
          )}
        </section>

        {/* RIGHT COLUMN: Payment & Verification Panel (02-staff/05, 16, 19) */}
        <section
          aria-label="Payment and verification controls"
          className="lg:col-span-12 xl:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
        >
          {!selectedSession ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Payment controls will appear once a session is selected.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900">Payment &amp; Verification</h2>
                {activeBill && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      activeBill.status === 'VERIFIED_PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeBill.status === 'PAYMENT_REPORTED'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {activeBill.status.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* 3-Step Verification Progress (matching 02-staff/19-payment-verification-invoice-printing.png) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  {[
                    { step: 1, title: '1. Unpaid', sub: 'Bill issued' },
                    { step: 2, title: '2. Reported', sub: 'UPI ref entered' },
                    { step: 3, title: '3. Verified', sub: 'Staff confirmed' },
                  ].map((s) => {
                    const reached = verificationStep >= s.step;
                    const current = verificationStep === s.step;
                    return (
                      <div key={s.step} className="flex flex-col items-center">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${
                            reached
                              ? s.step === 3
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#EF5301] text-white'
                              : 'border border-slate-300 bg-white text-slate-400'
                          } ${current ? 'ring-4 ring-orange-100' : ''}`}
                        >
                          {reached && s.step < verificationStep ? '✓' : s.step}
                        </div>
                        <span
                          className={`mt-1 font-bold ${
                            reached ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {s.title}
                        </span>
                        <span className="text-[10px] text-slate-500">{s.sub}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* If Customer/Staff Reported a Payment awaiting verification (T-06 / T-07) */}
              {reportedPayment && activeBill?.status === 'PAYMENT_REPORTED' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Clock className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-950">
                      <p className="font-bold">Unverified Payment Claim</p>
                      <p className="mt-0.5 text-blue-800">
                        Verify receipt of{' '}
                        <span className="font-extrabold">
                          {formatMoney(reportedPayment.amountMinor)}
                        </span>{' '}
                        in your restaurant bank / UPI app before marking Paid.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white border border-blue-100 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Method:</span>
                      <span className="font-bold text-slate-900">{reportedPayment.method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reported By:</span>
                      <span className="font-semibold text-slate-800">
                        {reportedPayment.reportedByType === 'CUSTOMER_GUEST'
                          ? 'Table Diner (Unverified)'
                          : reportedPayment.reportedByName || 'Staff'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">UPI / Txn Ref:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {reportedPayment.customerReference || 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleVerifyReportedPayment(false)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>Not Received</span>
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleVerifyReportedPayment(true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Verify &amp; Mark Paid</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Verified Paid State Summary */}
              {activeBill?.status === 'VERIFIED_PAID' ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-extrabold">Bill Verified &amp; Settled</span>
                  </div>
                  {activeBill.payments
                    .filter((p) => p.status === 'VERIFIED_PAID')
                    .map((p) => (
                      <div key={p.id} className="rounded-lg bg-white p-3 text-xs space-y-1 border border-emerald-100">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Method:</span>
                          <span className="font-bold">{p.method}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Amount Verified:</span>
                          <span className="font-bold text-emerald-700">{formatMoney(p.amountMinor)}</span>
                        </div>
                        {p.customerReference && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Reference:</span>
                            <span className="font-mono font-semibold">{p.customerReference}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-500">Verified By:</span>
                          <span className="font-semibold">{p.verifiedByName || 'Authorized Staff'}</span>
                        </div>
                        {p.verifiedAt && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Verified At:</span>
                            <span>{new Date(p.verifiedAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  <button
                    type="button"
                    onClick={() => setPreviewBill(activeBill)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print Final Invoice</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Generate Bill First if not generated */}
                  {!activeBill && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleGenerateBill(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#EF5301] bg-orange-50 py-2.5 text-xs font-extrabold text-[#EF5301] hover:bg-orange-100 disabled:opacity-50"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Generate Consolidated Bill Only</span>
                    </button>
                  )}

                  {/* Select Payment Method (matching 02-staff/05-billing-invoices.png) */}
                  <div className="space-y-2">
                    <span className="block text-xs font-bold text-slate-700">
                      Select Payment Method (Direct to Restaurant)
                    </span>
                    <div className="space-y-2">
                      {PAYMENT_METHODS.map((pm) => {
                        const Icon = pm.icon;
                        const active = selectedMethod === pm.value;
                        return (
                          <button
                            key={pm.value}
                            type="button"
                            onClick={() => setSelectedMethod(pm.value)}
                            className={`w-full flex items-center justify-between rounded-xl border p-3 text-left transition ${
                              active
                                ? 'border-[#EF5301] bg-orange-50/40'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon
                                className={`h-4 w-4 ${
                                  active ? 'text-[#EF5301]' : 'text-slate-500'
                                }`}
                              />
                              <div>
                                <div className="text-xs font-bold text-slate-900">{pm.label}</div>
                                <div className="text-[11px] text-slate-500">{pm.sublabel}</div>
                              </div>
                            </div>
                            <div
                              className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                active ? 'border-[#EF5301]' : 'border-slate-300'
                              }`}
                            >
                              {active && <div className="h-2 w-2 rounded-full bg-[#EF5301]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Restaurant UPI QR Card when UPI is selected (02-staff/16) */}
                  {selectedMethod === 'RESTAURANT_UPI_QR' && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center space-y-2">
                      {paymentSettings?.isActive ? (
                        <>
                          <UpiQrCode
                            upiId={paymentSettings.upiId}
                            displayName={paymentSettings.displayName || queueData?.tenantName}
                            amountMinor={
                              activeBill ? activeBill.totalMinor : selectedSession.estimatedTotalMinor
                            }
                            currency={selectedSession.currency}
                            qrAssetUrl={paymentSettings.qrAssetUrl}
                            size={132}
                          />
                          <p className="text-[11px] text-slate-500">
                            Customer scans and pays directly to the restaurant&apos;s UPI account.
                          </p>
                        </>
                      ) : (
                        <div className="py-3 space-y-1.5">
                          <p className="text-xs font-bold text-amber-800">
                            Branch UPI QR not active
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Ask the restaurant owner to configure UPI settings for this branch.
                          </p>
                          <Link
                            href="/owner/settings"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#EF5301] hover:underline"
                          >
                            <Settings className="h-3 w-3" />
                            <span>Configure in Owner Settings</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Optional Reference */}
                  <div>
                    <label
                      htmlFor="staff-payment-ref"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Transaction / Receipt Reference (optional)
                    </label>
                    <input
                      id="staff-payment-ref"
                      type="text"
                      value={paymentRefInput}
                      onChange={(e) => setPaymentRefInput(e.target.value)}
                      placeholder="e.g. UPI Ref 423116789045 or POS slip #"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#EF5301] focus:outline-none"
                    />
                  </div>

                  {/* Print toggle */}
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer">
                    <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <Printer className="h-4 w-4 text-slate-500" />
                      <span>Open Invoice Preview after payment</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={printAfterConfirm}
                      onChange={(e) => setPrintAfterConfirm(e.target.checked)}
                      className="h-4 w-4 accent-[#EF5301]"
                    />
                  </label>

                  {/* Primary Confirm & Receive Payment CTA */}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirmDirectPayment}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#EF5301] py-3 text-sm font-extrabold text-white shadow-md shadow-orange-600/20 hover:bg-[#d94900] transition disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    <span>Confirm &amp; Receive Payment</span>
                  </button>

                  {activeBill && (
                    <button
                      type="button"
                      onClick={() => setVoidModalOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Void Bill (Manager / Owner)</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>

      {/* Invoice Preview Modal (02-staff/19) */}
      {previewBill && (
        <InvoicePreviewModal bill={previewBill} onClose={() => setPreviewBill(null)} />
      )}

      {/* Void Bill Modal */}
      {voidModalOpen && activeBill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleVoidBill}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4"
          >
            <h3 className="text-base font-extrabold text-slate-900">
              Void Bill {activeBill.billNumber}
            </h3>
            <p className="text-xs text-slate-600">
              Voiding an unpaid bill records an audit entry and allows generating a fresh consolidated bill for this session.
            </p>
            <div>
              <label htmlFor="void-reason-input" className="block text-xs font-bold text-slate-700 mb-1">
                Reason for voiding *
              </label>
              <textarea
                id="void-reason-input"
                required
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Discount adjustment or cancelled item"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-[#EF5301] focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setVoidModalOpen(false);
                  setVoidReason('');
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !voidReason.trim()}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Void Bill
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
