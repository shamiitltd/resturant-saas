'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Save,
  Percent,
  CreditCard,
  Banknote,
  Wallet,
  Building2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { UpiQrCode } from '@/components/UpiQrCode';
import type {
  AuthMeResponseDto,
  RestaurantPaymentSettingsDto,
  RestaurantPaymentMethod,
} from '@restaurant-saas/contracts';

const METHOD_OPTIONS: Array<{
  id: RestaurantPaymentMethod;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'RESTAURANT_UPI_QR',
    label: 'Restaurant UPI QR',
    description: 'Customers scan your branch UPI QR and pay directly to your bank account.',
    icon: QrCode,
  },
  {
    id: 'CASH',
    label: 'Cash at Counter',
    description: 'Reception collects cash and marks consolidated bills verified paid.',
    icon: Banknote,
  },
  {
    id: 'CARD',
    label: 'Debit / Credit Card POS',
    description: 'Settlement via your branch card terminal recorded by reception.',
    icon: CreditCard,
  },
  {
    id: 'OTHER',
    label: 'Other / Store Credit',
    description: 'External wallets or restaurant voucher settlements.',
    icon: Wallet,
  },
];

export default function OwnerSettingsPage() {
  const [locations, setLocations] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [tenantName, setTenantName] = useState('Restaurant');

  const [upiId, setUpiId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [qrAssetUrl, setQrAssetUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [acceptedMethods, setAcceptedMethods] = useState<RestaurantPaymentMethod[]>([
    'RESTAURANT_UPI_QR',
    'CASH',
    'CARD',
    'OTHER',
  ]);
  const [isActive, setIsActive] = useState(false);
  const [taxRateInput, setTaxRateInput] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const loadSettingsForLocation = useCallback(async (locId?: string) => {
    try {
      const qs = locId ? `?locationId=${encodeURIComponent(locId)}` : '';
      const data = await fetchWithAuth<RestaurantPaymentSettingsDto>(
        `/v1/owner/payment-settings${qs}`
      );
      setSelectedLocationId(data.locationId);
      setUpiId(data.upiId || '');
      setDisplayName(data.displayName || '');
      setQrAssetUrl(data.qrAssetUrl || '');
      setInstructions(data.instructions || '');
      setAcceptedMethods(
        data.acceptedMethods?.length
          ? data.acceptedMethods
          : ['RESTAURANT_UPI_QR', 'CASH', 'CARD', 'OTHER']
      );
      setIsActive(Boolean(data.isActive));
      setTaxRateInput(
        data.taxRatePercent !== null && data.taxRatePercent !== undefined
          ? String(data.taxRatePercent)
          : ''
      );
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load branch payment & tax settings');
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const me = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');
        const membership = me.memberships[0];
        if (membership) {
          setTenantName(membership.tenantName);
          setLocations(membership.locations || []);
          const initialLoc =
            me.activeLocationId || membership.locations?.[0]?.id || undefined;
          await loadSettingsForLocation(initialLoc);
        } else {
          await loadSettingsForLocation();
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize owner settings');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [loadSettingsForLocation]);

  const toggleMethod = (method: RestaurantPaymentMethod) => {
    setAcceptedMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const parsedTax =
        taxRateInput.trim() === '' ? null : Number(taxRateInput.trim());

      const updated = await fetchWithAuth<RestaurantPaymentSettingsDto>(
        '/v1/owner/payment-settings',
        {
          method: 'PUT',
          body: JSON.stringify({
            locationId: selectedLocationId || undefined,
            upiId: upiId.trim() || null,
            displayName: displayName.trim() || null,
            qrAssetUrl: qrAssetUrl.trim() || null,
            instructions: instructions.trim() || null,
            acceptedMethods,
            isActive,
            taxRatePercent: parsedTax,
          }),
        }
      );

      setIsActive(updated.isActive);
      setTaxRateInput(
        updated.taxRatePercent !== null && updated.taxRatePercent !== undefined
          ? String(updated.taxRatePercent)
          : ''
      );
      setFeedback({
        type: 'success',
        message: `Saved billing & UPI payment configuration for ${updated.locationName || 'branch'}.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save payment settings',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FD5001]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header matching 03-owner/11-restaurant-profile-settings.png & 23-branch-specific-configuration.png */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEDFCE] text-[#FD5001]">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Branch Billing &amp; UPI Payment Settings
            </h1>
            <p className="text-xs text-slate-500">
              Configure {tenantName}&apos;s direct-to-restaurant UPI QR, payment methods, and tax rate per branch.
            </p>
          </div>
        </div>

        {locations.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs">
            <Building2 className="h-4 w-4 text-[#FD5001]" />
            <label htmlFor="branch-select" className="text-xs font-bold text-slate-600">
              Outlet:
            </label>
            <select
              id="branch-select"
              value={selectedLocationId}
              onChange={(e) => loadSettingsForLocation(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Main Form */}
        <div className="lg:col-span-8 space-y-6">
          {/* Direct Restaurant UPI QR Configuration */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Direct Restaurant UPI QR
                </h2>
                <p className="text-xs text-slate-500">
                  Diners pay your restaurant directly. No food-order payments pass through the SaaS gateway.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-bold text-slate-700">
                  {isActive ? 'Active' : 'Inactive'}
                </span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 accent-[#FD5001]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="upi-id-input" className="block text-xs font-bold text-slate-700 mb-1">
                  Restaurant UPI ID (VPA) *
                </label>
                <input
                  id="upi-id-input"
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. spicegarden@okicici"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-[#FD5001] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="upi-display-name"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Payee Display Name
                </label>
                <input
                  id="upi-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Spice Garden Hospitality"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-[#FD5001] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="qr-asset-url" className="block text-xs font-bold text-slate-700 mb-1">
                Custom QR Image URL (optional — leave blank to auto-generate scannable UPI QR)
              </label>
              <input
                id="qr-asset-url"
                type="url"
                value={qrAssetUrl}
                onChange={(e) => setQrAssetUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-[#FD5001] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="payment-instructions"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Diner Payment Instructions
              </label>
              <textarea
                id="payment-instructions"
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Scan with GPay / PhonePe / Paytm and enter your 12-digit UTR reference."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#FD5001] focus:outline-none"
              />
            </div>
          </div>

          {/* Billing & Tax Configuration (matching 03-owner/23-branch-specific-configuration.png) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Percent className="h-4 w-4 text-[#FD5001]" />
              <h2 className="text-base font-extrabold text-slate-900">Billing &amp; Tax Rate</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label htmlFor="tax-rate-input" className="block text-xs font-bold text-slate-700 mb-1">
                  Tax Rate (GST %) — leave blank for unconfigured (0%)
                </label>
                <input
                  id="tax-rate-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxRateInput}
                  onChange={(e) => setTaxRateInput(e.target.value)}
                  placeholder="e.g. 5.00"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-[#FD5001] focus:outline-none"
                />
              </div>
              <p className="text-xs text-slate-500">
                Applied server-side in integer minor units when diners submit new orders and shown on consolidated bills.
              </p>
            </div>
          </div>

          {/* Accepted Payment Methods */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">Accepted Payment Channels</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {METHOD_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const checked = acceptedMethods.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                      checked
                        ? 'border-[#FD5001] bg-[#FEDFCE]/25'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMethod(opt.id)}
                      className="mt-1 h-4 w-4 accent-[#FD5001]"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <Icon className="h-3.5 w-3.5 text-[#FD5001]" />
                        <span>{opt.label}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">{opt.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FD5001] px-6 py-3 text-sm font-extrabold text-white shadow-md shadow-orange-500/20 hover:bg-[#e14700] transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Branch Payment Settings</span>
            </button>
          </div>
        </div>

        {/* Right Live Preview Card */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs text-center space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Customer QR Preview
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isActive ? 'Visible to Diners' : 'Hidden'}
              </span>
            </div>

            <UpiQrCode
              upiId={upiId || null}
              displayName={displayName || tenantName}
              qrAssetUrl={qrAssetUrl || null}
              size={168}
            />

            <div className="rounded-xl bg-slate-50 p-3 text-left text-[11px] text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Manual Staff Verification Enforced</span>
              </div>
              <p>
                Customer-entered UPI references are shown to reception as unverified claims until staff confirms receipt in your UPI/bank app.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
