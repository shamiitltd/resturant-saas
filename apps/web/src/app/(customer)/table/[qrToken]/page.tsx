'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { publicFetch } from '@/lib/api';
import { Loader2, AlertCircle, UtensilsCrossed, CheckCircle2 } from 'lucide-react';
import type { ResolveQrResponseDto } from '@restaurant-saas/contracts';

export default function TableQrLandingPage() {
  const params = useParams();
  const router = useRouter();
  const qrToken = params.qrToken as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedTable, setResolvedTable] = useState<ResolveQrResponseDto | null>(null);

  useEffect(() => {
    if (!qrToken) return;

    let isMounted = true;

    async function resolveToken() {
      try {
        setLoading(true);
        setError(null);

        const data = await publicFetch<ResolveQrResponseDto>('/v1/public/table/resolve-qr', {
          method: 'POST',
          body: JSON.stringify({ qrToken }),
        });

        if (!isMounted) return;

        setResolvedTable(data);

        // Store session in localStorage
        try {
          localStorage.setItem('saas_table_session', JSON.stringify(data));
        } catch {
          // ignore
        }

        // Smooth transition to menu
        setTimeout(() => {
          router.push(`/${data.tenantSlug}/menu`);
        }, 800);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Unable to resolve table QR code. Please ask staff for assistance.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    resolveToken();

    return () => {
      isMounted = false;
    };
  }, [qrToken, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-orange-50/50 to-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-orange-100 bg-white p-6 shadow-xl text-center">
        {/* Brand Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-md shadow-orange-200">
          <UtensilsCrossed className="h-8 w-8" />
        </div>

        {loading && (
          <div className="py-6">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-600" />
            <h2 className="mt-4 font-bold text-slate-800 text-lg">Connecting to Table...</h2>
            <p className="mt-1 text-sm text-slate-500">Preparing your live digital menu</p>
          </div>
        )}

        {resolvedTable && !error && (
          <div className="py-4">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <h2 className="mt-2 font-bold text-slate-900 text-xl">{resolvedTable.tenantName}</h2>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-700 text-xs">
              <span>{resolvedTable.tableLabel} ({resolvedTable.tableCode})</span>
            </div>
            <p className="mt-4 text-xs text-slate-500">Redirecting to menu...</p>
          </div>
        )}

        {error && (
          <div className="py-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-3 font-bold text-slate-900 text-lg">Table Connection Failed</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full rounded-xl bg-slate-900 py-2.5 font-medium text-sm text-white transition hover:bg-slate-800"
            >
              Scan Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
