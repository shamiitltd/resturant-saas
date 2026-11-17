'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import { Building2, Mail, Lock, User, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { RegisterOwnerRequestDto, AuthMeResponseDto } from '@restaurant-saas/contracts';

export default function RegisterOwnerPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantSlug, setRestaurantSlug] = useState('');
  const [primaryOutletName, setPrimaryOutletName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-slugify when restaurant name changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRestaurantName(val);
    if (!restaurantSlug || restaurantSlug === slugify(restaurantName)) {
      setRestaurantSlug(slugify(val));
    }
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      // 1. Sign up user credentials with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const session = authData.session;
      if (!session) {
        // If email confirmation is required by Supabase configuration
        setErrorMessage('Verification email sent. Please verify your email before logging in.');
        setLoading(false);
        return;
      }

      // 2. Provision Tenant and Owner atomically via NestJS API
      const payload: RegisterOwnerRequestDto = {
        email: email.trim(),
        fullName: fullName.trim(),
        restaurantName: restaurantName.trim(),
        restaurantSlug: restaurantSlug.trim(),
        primaryOutletName: primaryOutletName.trim() || `${restaurantName.trim()} (Main)`,
        timezone,
      };

      await fetchWithAuth<AuthMeResponseDto>('/v1/auth/register-owner', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // 3. Registration complete -> Redirect to Owner Dashboard
      router.push('/owner/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Register your restaurant</h2>
        <p className="mt-1 text-sm text-slate-600">Create an operating tenant for your restaurant business</p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Owner Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Full Name</label>
            <div className="relative mt-1">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Chef Raghav"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 pl-9 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Work Email</label>
            <div className="relative mt-1">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="raghav@bistro.com"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 pl-9 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Create Password</label>
          <div className="relative mt-1">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 pl-9 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* Restaurant Business Details */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Restaurant Business Name</label>
          <div className="relative mt-1">
            <input
              type="text"
              required
              value={restaurantName}
              onChange={handleNameChange}
              placeholder="e.g. Saffron Table"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 pl-9 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Restaurant URL Subdomain</label>
          <div className="mt-1 flex rounded-lg border border-slate-300 shadow-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20">
            <input
              type="text"
              required
              pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
              value={restaurantSlug}
              onChange={(e) => setRestaurantSlug(slugify(e.target.value))}
              placeholder="saffron-table"
              className="w-full rounded-l-lg border-0 px-3.5 py-2 text-sm text-slate-900 focus:outline-none"
            />
            <span className="flex items-center rounded-r-lg bg-slate-50 px-3 text-xs text-slate-500 border-l border-slate-200">
              .platform.resto
            </span>
          </div>
          <span className="mt-1 block text-xs text-slate-500">Only lowercase alphanumeric letters and hyphens</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">First Outlet / Branch</label>
            <div className="relative mt-1">
              <input
                type="text"
                required
                value={primaryOutletName}
                onChange={(e) => setPrimaryOutletName(e.target.value)}
                placeholder="Downtown Flagship"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 pl-9 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#002CE8] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0025C5] focus:outline-none focus:ring-2 focus:ring-blue-600/50 disabled:opacity-60 transition"
        >
          {loading ? 'Setting up restaurant...' : 'Complete Registration'}
        </button>
      </form>

      <div className="text-center pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-800">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
