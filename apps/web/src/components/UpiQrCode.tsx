'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode } from 'lucide-react';

interface UpiQrCodeProps {
  upiId: string | null;
  displayName?: string | null;
  amountMinor?: number;
  currency?: string;
  qrAssetUrl?: string | null;
  size?: number;
}

export function UpiQrCode({
  upiId,
  displayName,
  amountMinor,
  currency = 'INR',
  qrAssetUrl,
  size = 160,
}: UpiQrCodeProps) {
  const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function generateQr() {
      if (qrAssetUrl && qrAssetUrl.trim() !== '') {
        setSvgDataUrl(null);
        return;
      }
      if (!upiId || upiId.trim() === '') {
        setSvgDataUrl(null);
        return;
      }

      const params = new URLSearchParams({
        pa: upiId.trim(),
        pn: (displayName || 'Restaurant').trim(),
        cu: currency || 'INR',
      });
      if (amountMinor && amountMinor > 0) {
        params.set('am', (amountMinor / 100).toFixed(2));
      }
      const upiUri = `upi://pay?${params.toString()}`;

      try {
        const dataUrl = await QRCode.toDataURL(upiUri, {
          width: size * 2,
          margin: 1,
          color: { dark: '#0F172A', light: '#FFFFFF' },
        });
        if (!cancelled) setSvgDataUrl(dataUrl);
      } catch {
        if (!cancelled) setSvgDataUrl(null);
      }
    }

    generateQr();
    return () => {
      cancelled = true;
    };
  }, [upiId, displayName, amountMinor, currency, qrAssetUrl, size]);

  const handleCopy = async () => {
    if (!upiId) return;
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard denial
    }
  };

  const imgSrc = qrAssetUrl?.trim() ? qrAssetUrl.trim() : svgDataUrl;

  return (
    <div className="flex flex-col items-center">
      <div
        className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs"
        style={{ width: size + 20, height: size + 20 }}
      >
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={upiId ? `UPI QR for ${upiId}` : 'Restaurant payment QR code'}
            width={size}
            height={size}
            className="h-full w-full object-contain rounded-lg"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-slate-400 p-3">
            <QrCode className="h-10 w-10 mb-1.5" />
            <span className="text-[11px] font-medium">No UPI QR configured</span>
          </div>
        )}
      </div>

      {upiId && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
          <span className="font-mono font-semibold text-slate-700 select-all">{upiId}</span>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy UPI ID"
            aria-label="Copy UPI ID"
            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
