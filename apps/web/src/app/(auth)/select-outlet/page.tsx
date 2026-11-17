'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api';
import { Building2, MapPin, Shield, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import type { AuthMeResponseDto, ActiveMembershipDto } from '@restaurant-saas/contracts';

interface FlatOutletOption {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  locationId: string;
  locationName: string;
  locationCode: string;
  primaryRole: string;
}

export default function SelectOutletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<FlatOutletOption[]>([]);

  useEffect(() => {
    async function loadUserMemberships() {
      try {
        const profile = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');

        const flatList: FlatOutletOption[] = [];
        for (const m of profile.memberships) {
          const role = m.roles[0]?.name || 'Staff';
          for (const loc of m.locations) {
            flatList.push({
              membershipId: m.membershipId,
              tenantId: m.tenantId,
              tenantName: m.tenantName,
              tenantSlug: m.tenantSlug,
              locationId: loc.id,
              locationName: loc.name,
              locationCode: loc.code,
              primaryRole: role,
            });
          }
        }

        setOutlets(flatList);

        // If only 1 outlet exists, auto-route
        if (flatList.length === 1) {
          await handleSelect(flatList[0]);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load authorized outlets.');
      } finally {
        setLoading(false);
      }
    }

    loadUserMemberships();
  }, []);

  const handleSelect = async (opt: FlatOutletOption) => {
    setSubmitting(opt.locationId);
    setErrorMessage(null);

    try {
      await fetchWithAuth('/v1/auth/select-outlet', {
        method: 'POST',
        body: JSON.stringify({
          membershipId: opt.membershipId,
          locationId: opt.locationId,
        }),
      });

      // Navigate based on role
      if (opt.primaryRole.toLowerCase().includes('owner')) {
        router.push('/owner/dashboard');
      } else if (opt.primaryRole.toLowerCase().includes('chef')) {
        router.push('/staff/kitchen');
      } else if (opt.primaryRole.toLowerCase().includes('waiter')) {
        router.push('/staff/waiter');
      } else {
        router.push('/staff/reception');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to activate location context.');
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-sm">Loading authorized outlets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Select restaurant outlet</h2>
        <p className="mt-1 text-sm text-slate-600">Choose the venue branch you are working in for this session</p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {outlets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            <p className="text-sm">No active branch assignments found for your account.</p>
          </div>
        ) : (
          outlets.map((opt) => (
            <div
              key={`${opt.membershipId}-${opt.locationId}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-400 hover:shadow-md transition"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">{opt.locationName}</span>
                  <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                    {opt.primaryRole}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{opt.tenantName}</span>
                  <span>•</span>
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{opt.locationCode}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting !== null}
                onClick={() => handleSelect(opt)}
                className="flex items-center gap-1.5 rounded-lg bg-[#002CE8] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0025C5] focus:outline-none disabled:opacity-60 transition"
              >
                {submitting === opt.locationId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Enter</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
