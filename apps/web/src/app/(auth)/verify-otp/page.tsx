'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth, publicFetch } from '@/lib/api';
import { BistroLogo } from '@/components/BistroLogo';
import { AuthHeroPanel } from '@/components/AuthHeroPanel';
import {
  ShieldCheck,
  CheckCircle2,
  Zap,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import type { AuthMeResponseDto } from '@restaurant-saas/contracts';

const VERIFY_HERO_FEATURES = [
  { icon: CheckCircle2, label: 'Confirm your identity' },
  { icon: ShieldCheck, label: 'Keep your account secure' },
  { icon: Zap, label: 'Get started in seconds' },
];

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');

  // Support 8-digit OTP (default in Supabase) and 6-digit OTP
  const [otpLength, setOtpLength] = useState<8 | 6>(8);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [devConfirmLoading, setDevConfirmLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam.toLowerCase().trim());
    } else {
      try {
        const pending = localStorage.getItem('pending_owner_onboarding');
        if (pending) {
          const parsed = JSON.parse(pending);
          if (parsed.email) setEmail(parsed.email.toLowerCase().trim());
        }
      } catch {}
    }
  }, [searchParams]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCountdown]);

  const switchOtpLength = (newLength: 8 | 6) => {
    setOtpLength(newLength);
    setDigits(Array(8).fill(''));
    setErrorMessage(null);
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 50);
  };

  const handleDigitChange = (index: number, val: string) => {
    const char = val.slice(-1); // Only take latest char
    if (char && !/^\d$/.test(char)) return;

    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setErrorMessage(null);

    // If entered a digit, auto focus next input
    if (char && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').trim();
    if (!pasted) return;

    if (pasted.length === 8) {
      setOtpLength(8);
      const arr = pasted.split('').slice(0, 8);
      setDigits(arr);
      inputRefs.current[7]?.focus();
    } else if (pasted.length === 6) {
      setOtpLength(6);
      const arr = Array(8).fill('');
      for (let i = 0; i < 6; i++) arr[i] = pasted[i];
      setDigits(arr);
      inputRefs.current[5]?.focus();
    } else {
      const len = pasted.length > 6 ? 8 : 6;
      setOtpLength(len);
      const arr = Array(8).fill('');
      for (let i = 0; i < Math.min(pasted.length, 8); i++) arr[i] = pasted[i];
      setDigits(arr);
      inputRefs.current[Math.min(pasted.length, len - 1)]?.focus();
    }
  };

  const completeOnboardingAndRedirect = async () => {
    // 1. Ensure active Supabase session
    let session = (await supabase.auth.getSession()).data.session;
    const cleanEmail = email.trim().toLowerCase();

    if (!session) {
      const savedPassword = localStorage.getItem('pending_owner_password');
      if (savedPassword && cleanEmail) {
        const signIn = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: savedPassword,
        });
        session = signIn.data?.session;
      }
    }

    if (!session) {
      router.push('/login');
      return;
    }

    // 2. Check pending owner onboarding to provision
    const pending = localStorage.getItem('pending_owner_onboarding');
    if (pending) {
      const payload = JSON.parse(pending);
      await fetchWithAuth<AuthMeResponseDto>('/v1/auth/register-owner', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      localStorage.removeItem('pending_owner_onboarding');
      localStorage.removeItem('pending_owner_password');
      router.push('/owner/dashboard');
      return;
    }

    // 3. Check existing memberships
    const profile = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');
    if (profile.memberships.length > 0) {
      router.push('/owner/dashboard');
    } else {
      router.push('/register');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const otpCode = digits.slice(0, otpLength).join('').trim();
    if (otpCode.length !== otpLength) {
      setErrorMessage(`Please enter all ${otpLength} digits of your verification code.`);
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // Attempt Supabase OTP verification with type: 'signup'
      let verifyRes = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: otpCode,
        type: 'signup',
      });

      // Fallback with type: 'email'
      if (verifyRes.error) {
        verifyRes = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: otpCode,
          type: 'email',
        });
      }

      // Check for active session
      let activeSession = verifyRes.data?.session;

      if (!activeSession) {
        const sess = await supabase.auth.getSession();
        activeSession = sess.data?.session;
      }

      if (!activeSession) {
        // Authenticate with saved password
        const savedPassword = localStorage.getItem('pending_owner_password');
        if (savedPassword) {
          const signIn = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: savedPassword,
          });
          activeSession = signIn.data?.session;
        }
      }

      if (verifyRes.error && !activeSession) {
        throw new Error(verifyRes.error.message || 'Invalid or expired verification code.');
      }

      if (!activeSession) {
        throw new Error('Account verified, but active session could not be established. Please log in.');
      }

      await completeOnboardingAndRedirect();
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resendLoading) return;
    setResendLoading(true);
    setResendSuccess(false);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });

      if (error) {
        throw new Error(error.message);
      }

      setResendSuccess(true);
      setResendCountdown(60);
      setCanResend(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend code. Please try again shortly.');
    } finally {
      setResendLoading(false);
    }
  };

  // Dev bypass helper: directly marks user confirmed in DB
  const handleDevConfirm = async () => {
    setDevConfirmLoading(true);
    setErrorMessage(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      await publicFetch('/v1/auth/dev-confirm', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail }),
      });

      const savedPassword = localStorage.getItem('pending_owner_password') || '';
      if (savedPassword) {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: savedPassword,
        });
        if (error) throw new Error(error.message);
        await completeOnboardingAndRedirect();
      } else {
        router.push('/login');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Auto-confirm failed. Please use verification code.');
    } finally {
      setDevConfirmLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeDigits = digits.slice(0, otpLength);

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden w-full bg-[#F8FAFC]">
      {/* Left Branded Hero Panel (Exact Match to 05-email-otp-verification.png) */}
      <AuthHeroPanel
        className="hidden lg:flex lg:w-[45%] xl:w-[42%]"
        titlePrefix="Verify your"
        titleHighlight="account"
        subtitle="Confirm your identity to keep your restaurant account safe and start managing orders."
        features={VERIFY_HERO_FEATURES}
        footerBadge="Enterprise Grade Security"
      />

      {/* Right Column: Centered Floating Card */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto lg:overflow-y-hidden">
        <div className="w-full max-w-[480px] bg-white rounded-3xl p-8 sm:p-10 border border-slate-100 shadow-xl text-center">
          {/* Logo Header */}
          <div className="flex justify-center mb-4">
            <BistroLogo theme="dark" size="md" />
          </div>

          {/* Envelope Graphic Illustration */}
          <div className="flex justify-center my-3">
            <div className="relative w-24 h-20">
              <Image
                src="/email-otp-illustration.png"
                alt="Verification code sent"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Verify Your Email
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm mx-auto">
            We&apos;ve sent a <span className="font-semibold text-slate-800">{otpLength}-digit</span> verification code to{' '}
            <span className="font-semibold text-slate-900 break-all">
              {email || 'your email address'}
            </span>
            .
          </p>

          {/* 8-Digit vs 6-Digit Code Length Switcher */}
          <div className="mt-4 inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => switchOtpLength(8)}
              className={`py-1 px-3 text-xs font-semibold rounded-lg transition ${
                otpLength === 8
                  ? 'bg-white text-[#0038FF] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              8-Digit Code
            </button>
            <button
              type="button"
              onClick={() => switchOtpLength(6)}
              className={`py-1 px-3 text-xs font-semibold rounded-lg transition ${
                otpLength === 6
                  ? 'bg-white text-[#0038FF] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              6-Digit Code
            </button>
          </div>

          {errorMessage && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 text-left">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {resendSuccess && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 text-left">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-medium">New verification code has been dispatched!</span>
            </div>
          )}

          {/* Digit Input Fields */}
          <form onSubmit={handleVerify} className="mt-6 space-y-6">
            <div
              className={`flex items-center justify-center ${
                otpLength === 8 ? 'gap-1.5 sm:gap-2' : 'gap-2 sm:gap-2.5'
              }`}
              onPaste={handlePaste}
            >
              {activeDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`text-center font-bold rounded-xl border transition focus:outline-none ${
                    otpLength === 8
                      ? 'h-12 w-9 sm:h-13 sm:w-11 text-lg sm:text-xl'
                      : 'h-13 w-11 sm:h-14 sm:w-12 text-xl'
                  } ${
                    digit
                      ? 'border-[#0038FF] bg-[#EEF4FF] text-slate-900'
                      : 'border-slate-200 bg-white text-slate-900 focus:border-[#0038FF] focus:ring-2 focus:ring-[#0038FF]/20'
                  }`}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            {/* Resend Timer */}
            <div className="text-xs text-slate-500">
              Didn&apos;t receive the code?{' '}
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="font-bold text-[#0038FF] hover:underline focus:outline-none"
                >
                  {resendLoading ? 'Sending...' : 'Resend Code'}
                </button>
              ) : (
                <span className="font-semibold text-slate-700">
                  Resend in {formatTimer(resendCountdown)}
                </span>
              )}
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || activeDigits.join('').length < otpLength}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0038FF] hover:bg-[#0025C5] text-white text-sm font-semibold shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#0038FF]/40 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying Account...
                </>
              ) : (
                'Verify Account'
              )}
            </button>

            {/* Change Email Button */}
            <Link
              href="/register"
              className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Change Email
            </Link>

            {/* Dev helper: Instant confirm */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDevConfirm}
                disabled={devConfirmLoading}
                className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 font-medium transition"
              >
                {devConfirmLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                Quick Auto-Confirm (Dev Bypass)
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-400">
          Secure verification powered by The Bistro OS
        </p>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center bg-[#F8FAFC]">
          <Loader2 className="h-8 w-8 animate-spin text-[#0038FF]" />
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
