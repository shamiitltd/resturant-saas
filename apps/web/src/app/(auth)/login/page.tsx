'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import type { AuthMeResponseDto } from '@restaurant-saas/contracts';

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

      // 1. Authenticate with Supabase Auth (authoritative credentials provider)
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
      const primaryRole = profile.memberships[0]?.roles[0]?.code;
      if (primaryRole === 'OWNER') {
        router.push('/owner/dashboard');
      } else if (primaryRole === 'CHEF') {
        router.push('/staff/kitchen');
      } else if (primaryRole === 'WAITER') {
        router.push('/staff/waiter');
      } else {
        router.push('/staff/reception');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to your restaurant</h2>
          <p className="mt-1 text-sm text-slate-600">Enter your credentials to access your operating dashboard</p>
        </div>
        <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to your restaurant</h2>
        <p className="mt-1 text-sm text-slate-600">Enter your credentials to access your operating dashboard</p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p>{errorMessage}</p>
            {errorMessage.toLowerCase().includes('email not confirmed') && (
              <p className="mt-2">
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

      <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Email address</label>
          <div className="relative mt-1">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@restaurant.com"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-blue-600 hover:text-blue-800">
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-600">Keep me signed in</span>
          </label>
          <Link href="/verify-otp" className="text-xs font-medium text-slate-600 hover:text-slate-900">
            Sign in with OTP
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#002CE8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0025C5] focus:outline-none focus:ring-2 focus:ring-blue-600/50 disabled:opacity-60 transition"
        >
          {loading ? 'Verifying...' : 'Sign in to Dashboard'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <div className="text-center pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-600">
          New restaurant business?{' '}
          <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-800">
            Register your restaurant
          </Link>
        </p>
      </div>
    </div>
  );
}
