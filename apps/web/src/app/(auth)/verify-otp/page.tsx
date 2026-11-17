'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';

export default function VerifyOtpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.session) {
        router.push('/select-outlet');
      } else {
        router.push('/login');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Verify OTP code</h2>
        <p className="mt-1 text-sm text-slate-600">Enter the 6-digit security code sent to your email</p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Email address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@restaurant.com"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">6-Digit Code</label>
          <input
            type="text"
            required
            maxLength={6}
            pattern="[0-9]{6}"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-center text-2xl font-bold tracking-widest text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#002CE8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0025C5] focus:outline-none focus:ring-2 focus:ring-blue-600/50 disabled:opacity-60 transition"
        >
          {loading ? 'Verifying...' : 'Verify & Continue'}
        </button>
      </form>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <Link href="/login" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to login
        </Link>
        <button
          type="button"
          onClick={() => alert('Verification code resent if email is registered.')}
          className="text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          Resend code
        </button>
      </div>
    </div>
  );
}
