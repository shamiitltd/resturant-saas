'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import { BistroLogo } from '@/components/BistroLogo';
import { AuthHeroPanel } from '@/components/AuthHeroPanel';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Bell,
  BarChart3,
  Store,
  Cloud,
  Loader2,
} from 'lucide-react';
import type { AuthMeResponseDto } from '@restaurant-saas/contracts';

const LOGIN_HERO_FEATURES = [
  { icon: Bell, label: 'Order & Table Management' },
  { icon: BarChart3, label: 'Reports & Business Insights' },
  { icon: Store, label: 'Multi-Outlet Operations' },
  { icon: Cloud, label: 'Integrations & Payments' },
];

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.session) {
        throw new Error('Authentication succeeded but no active session was returned.');
      }

      // 2. Fetch verified memberships and permissions from NestJS API
      const profile = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');

      // 3. Route user according to their verified roles & outlet access
      if (profile.isPlatformAdmin) {
        router.push('/admin/dashboard');
        return;
      }

      if (profile.memberships.length === 0) {
        // If user already filled registration form, complete it now
        const pending = localStorage.getItem('pending_owner_onboarding');
        if (pending) {
          try {
            const payload = JSON.parse(pending);
            await fetchWithAuth<AuthMeResponseDto>('/v1/auth/register-owner', {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            localStorage.removeItem('pending_owner_onboarding');
            localStorage.removeItem('pending_owner_password');
            router.push('/owner/dashboard');
            return;
          } catch (onboardingErr) {
            console.error('Pending onboarding on login error:', onboardingErr);
          }
        }
        router.push('/register');
        return;
      }

      // If user has multiple locations or memberships, direct to outlet selector
      const totalLocations = profile.memberships.flatMap((m) => m.locations);
      if (totalLocations.length > 1) {
        router.push('/select-outlet');
        return;
      }

      // Direct based on primary role
      const roleCode = (
        profile.memberships[0]?.roles[0]?.code ||
        profile.memberships[0]?.roles[0]?.name ||
        ''
      ).toUpperCase();

      if (roleCode.includes('OWNER')) {
        router.push('/owner/dashboard');
      } else if (roleCode.includes('CHEF')) {
        router.push('/kitchen');
      } else if (roleCode.includes('WAITER')) {
        router.push('/waiter');
      } else {
        router.push('/reception');
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('not confirmed') || msg.toLowerCase().includes('email_not_confirmed')) {
        router.push(`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`);
        return;
      }
      setErrorMessage(msg || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden w-full bg-[#F8FAFC]">
      {/* Left Branded Hero Panel */}
      <AuthHeroPanel
        className="hidden lg:flex lg:w-[45%] xl:w-[42%]"
        titlePrefix="Run your restaurant"
        titleHighlight="smarter"
        subtitle="All-in-one platform to manage orders, tables, menu, staff, billing and grow your business."
        features={LOGIN_HERO_FEATURES}
      />

      {/* Right Content Column (Form Canvas) */}
      <div className="flex flex-1 flex-col justify-center items-center px-4 sm:px-8 lg:px-12 py-6 lg:py-8 bg-[#F8FAFC] overflow-y-auto lg:overflow-y-hidden">
        {/* Mobile Header (Visible on small screens only) */}
        <div className="mb-6 lg:hidden">
          <BistroLogo theme="dark" size="md" />
        </div>

        {/* Floating White Card */}
        <div className="w-full max-w-[460px] rounded-3xl bg-white p-8 sm:p-10 shadow-xl border border-slate-100">
          {/* Card Top Logo (Visible on desktop) */}
          <div className="hidden lg:flex justify-center mb-5">
            <BistroLogo theme="dark" size="md" />
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to your account
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <p>{errorMessage}</p>
                {errorMessage.toLowerCase().includes('email not confirmed') && (
                  <p className="mt-1.5">
                    <Link
                      href={`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                      className="font-semibold text-blue-700 underline hover:text-blue-900"
                    >
                      Click here to enter your verification code
                    </Link>
                  </p>
                )}
              </div>
            </div>
          )}

          {mounted ? (
            <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
              {/* Email / Mobile Input */}
              <div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email or Mobile Number"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0038FF] focus:ring-[#0038FF]"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    Remember me
                  </span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-[#0038FF] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0038FF] py-3.5 text-sm font-semibold text-white shadow-md hover:bg-[#002ED6] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/50 disabled:opacity-60 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              {/* Or Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400 font-medium">
                    or
                  </span>
                </div>
              </div>

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={() =>
                  alert('Google Sign-in is available in staging/production with verified OAuth credentials.')
                }
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </form>
          ) : (
            <div className="h-64 rounded-xl bg-slate-50 animate-pulse" />
          )}

          {/* New to Bistro OS Link */}
          <div className="mt-6 text-center text-xs text-slate-600">
            <span>New to The Bistro OS? </span>
            <Link
              href="/register"
              className="font-bold text-[#0038FF] hover:underline"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
