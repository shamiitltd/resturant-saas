'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BistroLogo } from '@/components/BistroLogo';
import { AuthHeroPanel } from '@/components/AuthHeroPanel';
import {
  Lock,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Key,
  Mail,
  UserCheck,
} from 'lucide-react';

const RESET_HERO_FEATURES = [
  { icon: Lock, label: 'Keep your account secure' },
  { icon: ShieldCheck, label: 'Use a strong, unique password' },
  { icon: Key, label: 'Access your restaurant anytime' },
];

export default function ResetPasswordPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('raghavagg2005@gmail.com');
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    async function initSession() {
      try {
        // 1. Check URL hash (#access_token=...&refresh_token=... or #error=...)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hash = window.location.hash.substring(1);
          const hashParams = new URLSearchParams(hash);

          // If there is an expired or invalid token error in hash, clean the URL so it doesn't get stuck
          if (hashParams.get('error') || hashParams.get('error_description')) {
            window.history.replaceState(null, '', window.location.pathname);
          }

          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { data } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (data?.session?.user?.email) {
              setEmail(data.session.user.email);
              setHasSession(true);
            }
          }
        }

        // 2. Check URL search query (?code=... or ?email=...)
        if (typeof window !== 'undefined' && window.location.search) {
          const searchParams = new URLSearchParams(window.location.search);
          const code = searchParams.get('code');
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && data?.session?.user?.email) {
              setEmail(data.session.user.email);
              setHasSession(true);
            }
          }

          const queryEmail = searchParams.get('email');
          if (queryEmail) {
            setEmail(queryEmail);
          }
        }

        // 3. Fallback: check existing active Supabase session or localStorage
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setEmail(session.user.email);
          setHasSession(true);
        } else {
          const cachedEmail = localStorage.getItem('bistro_reset_email');
          if (cachedEmail) {
            setEmail(cachedEmail);
          }
        }
      } catch (err) {
        console.warn('Notice establishing recovery session on mount:', err);
      }
    }

    initSession();
  }, []);

  // Validation rules matching 04-reset-password.png
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const score = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
  const isStrong = score >= 4;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail =
      email.trim().toLowerCase() ||
      localStorage.getItem('bistro_reset_email') ||
      'raghavagg2005@gmail.com';

    if (!cleanEmail) {
      setErrorMessage('Please provide your account email.');
      return;
    }

    if (!hasMinLength) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // 1. Direct Next.js Admin API route (always available on same origin, no session required)
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || resData.message || 'Failed to update password');
      }

      // 2. Also update in-memory client session if one exists
      try {
        await supabase.auth.updateUser({ password });
      } catch {}

      setSuccessMessage('Password has been successfully updated! Redirecting to login...');
      setTimeout(() => {
        router.push('/login?reset=success');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden w-full bg-[#F8FAFC]">
      {/* Left Branded Hero Panel (Exact Match to 04-reset-password.png) */}
      <AuthHeroPanel
        className="hidden lg:flex lg:w-[45%] xl:w-[42%]"
        titlePrefix="Set a new password for"
        titleHighlight="your account"
        subtitle="Create a strong and secure password to get back to The Bistro OS."
        features={RESET_HERO_FEATURES}
        footerBadge="Protected by The Bistro OS"
      />

      {/* Right Column: Centered Floating Card */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto lg:overflow-y-hidden">
        <div className="w-full max-w-[460px] bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100">
          {/* Logo Header */}
          <div className="flex justify-center mb-4">
            <BistroLogo theme="dark" size="md" />
          </div>

          <div className="text-center mb-5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Reset Password
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Enter your account email and choose a new password.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 text-left">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 text-left">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Account Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="raghavagg2005@gmail.com"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                />
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 4-Bar Password Strength Indicator (04-reset-password.png) */}
            {password.length > 0 && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Password strength</span>
                  <span
                    className={`font-bold ${
                      isStrong
                        ? 'text-emerald-600'
                        : score >= 3
                        ? 'text-amber-600'
                        : 'text-red-500'
                    }`}
                  >
                    {isStrong ? 'Strong' : score >= 3 ? 'Medium' : 'Weak'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      score >= 1
                        ? isStrong
                          ? 'bg-emerald-500'
                          : score >= 3
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                        : 'bg-slate-200'
                    }`}
                  />
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      score >= 2
                        ? isStrong
                          ? 'bg-emerald-500'
                          : score >= 3
                          ? 'bg-amber-500'
                          : 'bg-red-400'
                        : 'bg-slate-200'
                    }`}
                  />
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      score >= 3
                        ? isStrong
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                        : 'bg-slate-200'
                    }`}
                  />
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      score >= 4 ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password Criteria Checklist */}
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700 mb-1">Password must contain:</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
                  <Check className={`h-3.5 w-3.5 ${hasMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
                  <Check className={`h-3.5 w-3.5 ${hasUppercase ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span>One uppercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
                  <Check className={`h-3.5 w-3.5 ${hasNumber ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span>One number</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
                  <Check className={`h-3.5 w-3.5 ${hasSpecial ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span>One special character</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !hasMinLength || password !== confirmPassword}
              className="w-full rounded-xl bg-[#002CE8] py-3 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-[#0025C5] focus:outline-none focus:ring-2 focus:ring-[#002CE8]/40 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#002CE8] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to login</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
