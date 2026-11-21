'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import { ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import type { AuthMeResponseDto } from '@restaurant-saas/contracts';

export default function VerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam.toLowerCase());
    } else {
      try {
        const pending = localStorage.getItem('pending_owner_onboarding');
        if (pending) {
          const parsed = JSON.parse(pending);
          if (parsed.email) setEmail(parsed.email.toLowerCase());
        }
      } catch {}
    }
  }, [searchParams]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: 'signup',
      });

      if (error) {
        // Fallback to 'email' in case of magiclink or email change OTP
        const fallback = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanOtp,
          type: 'email',
        });
        if (fallback.error) {
          throw new Error(error.message);
        }
        data = fallback.data;
      }

      if (data.session) {
        // Check if there is a pending owner onboarding to complete
        const pending = localStorage.getItem('pending_owner_onboarding');
        if (pending) {
          try {
            const payload = JSON.parse(pending);
            await fetchWithAuth<AuthMeResponseDto>('/v1/auth/register-owner', {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            localStorage.removeItem('pending_owner_onboarding');
            router.push('/owner/dashboard');
            return;
          } catch (onboardingErr: any) {
            console.error('Pending onboarding error:', onboardingErr);
          }
        }
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

  const handleResend = async () => {
    if (!email) return;
    setResendLoading(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });
      if (error) throw error;
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend verification code.');
    } finally {
      setResendLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Verify OTP code</h2>
          <p className="mt-1 text-sm text-slate-600">Enter the 6-digit security code sent to your email</p>
        </div>
        <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Verify OTP code</h2>
        <p className="mt-1 text-sm text-slate-600">Enter the security verification code sent to your email</p>
      </div>

      {resendSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          A new verification code has been sent to your email.
        </div>
      )}

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
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Security Code</label>
          <input
            type="text"
            required
            maxLength={10}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter code (6 or 8 digits)"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-center text-2xl font-bold tracking-widest text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          <p className="mt-1 text-xs text-slate-500 text-center">Enter the full numeric code received in your email</p>
        </div>

        <button
          type="submit"
          disabled={loading || otp.trim().length < 6}
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
          onClick={handleResend}
          disabled={resendLoading || !email}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {resendLoading ? 'Sending...' : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
