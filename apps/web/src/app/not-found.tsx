'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BistroLogo } from '@/components/BistroLogo';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import {
  Compass,
  ArrowLeft,
  LayoutDashboard,
  UtensilsCrossed,
  ChefHat,
  Users,
  Store,
  HelpCircle,
  ShieldCheck,
  Search,
  Home,
  RefreshCw,
} from 'lucide-react';
import type { AuthMeResponseDto } from '@restaurant-saas/contracts';

export default function NotFound() {
  const router = useRouter();
  const [dashboardUrl, setDashboardUrl] = useState('/owner/dashboard');
  const [roleLabel, setRoleLabel] = useState<string>('Owner / Staff');

  useEffect(() => {
    async function resolveTarget() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const profile = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');
          if (profile.isPlatformAdmin) {
            setDashboardUrl('/admin/dashboard');
            setRoleLabel('Platform Super Admin');
          } else if (profile.memberships && profile.memberships.length > 0) {
            const role = profile.memberships[0]?.roles[0]?.name?.toLowerCase() || '';
            if (role.includes('owner')) {
              setDashboardUrl('/owner/dashboard');
              setRoleLabel('Restaurant Owner');
            } else if (role.includes('chef')) {
              setDashboardUrl('/staff/kitchen');
              setRoleLabel('Kitchen Chef');
            } else if (role.includes('waiter')) {
              setDashboardUrl('/staff/waiter');
              setRoleLabel('Service Waiter');
            } else {
              setDashboardUrl('/staff/reception');
              setRoleLabel('Reception Staff');
            }
          }
        }
      } catch {
        // Fallback to owner dashboard or home
        setDashboardUrl('/owner/dashboard');
      }
    }

    resolveTarget();
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col justify-between text-slate-800 antialiased">
      {/* Header Bar */}
      <header className="w-full bg-[#070F26] px-6 sm:px-12 py-3.5 flex items-center justify-between border-b border-slate-800 shadow-xs">
        <Link href="/" className="flex items-center gap-2">
          <BistroLogo theme="light" />
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] font-bold text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Systems Online</span>
          </span>

          <Link
            href={dashboardUrl}
            className="flex items-center gap-1.5 rounded-xl bg-[#FF4E00] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Go to Dashboard</span>
            <span className="sm:hidden">Dashboard</span>
          </Link>
        </div>
      </header>

      {/* Main 404 Hero Section */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl text-center space-y-6">
          {/* Visual 404 Illustration Badge */}
          <div className="relative inline-flex items-center justify-center">
            {/* Background Glow */}
            <div className="absolute -inset-4 rounded-full bg-orange-500/10 blur-xl" />

            <div className="relative flex flex-col items-center">
              <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-linear-to-b from-orange-50 to-orange-100/80 border border-orange-200/80 shadow-md">
                <Compass className="h-12 w-12 sm:h-14 sm:w-14 text-[#FF4E00] animate-spin-slow" />
              </div>

              {/* 404 Pill */}
              <div className="-mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1 text-xs font-black tracking-wider text-white shadow-sm">
                <span>ERROR 404</span>
              </div>
            </div>
          </div>

          {/* Headline & Description */}
          <div className="space-y-2 max-w-md mx-auto">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Page Not Found
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              The dish or page you are looking for isn&apos;t on the menu. It may have been moved, temporarily 86-ed, or the URL address might be mistyped.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 transition"
            >
              <ArrowLeft className="h-4 w-4 text-slate-500" />
              <span>Go Back</span>
            </button>

            <Link
              href={dashboardUrl}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF4E00] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#e04500] transition"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Go to {roleLabel}</span>
            </Link>

            <Link
              href="/spice-garden/menu"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-xs font-bold text-orange-800 hover:bg-orange-100 transition"
            >
              <UtensilsCrossed className="h-4 w-4 text-orange-600" />
              <span>Digital Menu</span>
            </Link>
          </div>

          {/* Quick Route Directory Cards */}
          <div className="pt-6 border-t border-slate-200/80">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-3">
              Common Destinations
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <Link
                href="/owner/dashboard"
                className="group flex flex-col justify-between p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-orange-300 hover:shadow-xs transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100">
                    <Store className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-[#FF4E00] transition truncate">
                      Owner Dashboard
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      Sales, menu &amp; outlets
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href="/staff/kitchen"
                className="group flex flex-col justify-between p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-orange-300 hover:shadow-xs transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                    <ChefHat className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition truncate">
                      Kitchen KDS
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      Active tickets &amp; ETAs
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href="/staff/waiter"
                className="group flex flex-col justify-between p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-orange-300 hover:shadow-xs transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition truncate">
                      Waiter &amp; Tables
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      Service pickup &amp; delivery
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white py-4 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Restaurant SaaS Platform — Multi-Tenant Architecture</span>
        </div>
        <p className="text-[11px]">
          Need assistance? Contact your restaurant administrator.
        </p>
      </footer>
    </div>
  );
}
