'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import { BistroLogo } from '@/components/BistroLogo';
import {
  ShieldAlert,
  ArrowLeft,
  Info,
  Bell,
  ChevronDown,
  Headphones,
  LayoutDashboard,
} from 'lucide-react';
import type { AuthMeResponseDto } from '@restaurant-saas/contracts';

export default function AccessDeniedPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('Raghav Aggarwal');
  const [userInitials, setUserInitials] = useState('RA');
  const [dashboardUrl, setDashboardUrl] = useState('/login');

  useEffect(() => {
    async function resolveUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const profile = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');
          const name =
            profile.user.fullName ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'Staff Member';
          setUserName(name);
          setUserInitials(
            name
              .split(' ')
              .map((n: string) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase() || 'RA'
          );

          // Determine dashboard target
          if (profile.isPlatformAdmin) {
            setDashboardUrl('/admin/dashboard');
          } else if (profile.memberships.length > 0) {
            const role = profile.memberships[0]?.roles[0]?.name?.toLowerCase() || '';
            if (role.includes('owner')) {
              setDashboardUrl('/owner/dashboard');
            } else if (role.includes('chef')) {
              setDashboardUrl('/staff/kitchen');
            } else if (role.includes('waiter')) {
              setDashboardUrl('/staff/waiter');
            } else {
              setDashboardUrl('/staff/reception');
            }
          } else {
            setDashboardUrl('/select-outlet');
          }
        }
      } catch {
        // Fallback to select-outlet
        setDashboardUrl('/select-outlet');
      }
    }

    resolveUser();
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col">
      {/* Top Navigation Bar (Exact Match to 07-access-denied.png) */}
      <header className="w-full bg-[#070F26] px-6 sm:px-12 py-3.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <BistroLogo theme="light" />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="relative p-2 text-slate-300 hover:text-white transition"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>

          <div className="h-5 w-px bg-slate-700" />

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DCE8FF] text-[#0038FF] font-bold text-xs">
              {userInitials}
            </div>
            <span className="text-xs font-semibold text-white hidden sm:inline-block">
              {userName}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
      </header>

      {/* Main Content: 2 Columns */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 sm:p-12 lg:p-16 flex flex-col lg:flex-row items-center justify-between gap-12 my-auto">
        {/* Left Column: Access Denied Message */}
        <div className="max-w-xl w-full space-y-6 text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200 px-3.5 py-1 text-xs font-semibold text-rose-600">
            <ShieldAlert className="h-4 w-4" />
            <span>Access Denied</span>
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              You don&apos;t have permission to access this page.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-500 leading-relaxed">
              You&apos;re signed in, but your account doesn&apos;t have the required access to view this resource.
            </p>
          </div>

          {/* Callout box */}
          <div className="rounded-2xl border border-blue-100 bg-[#F0F5FF]/70 p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Info className="h-4 w-4 text-[#0038FF]" />
              <span>Possible reasons:</span>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600 pl-6 list-disc">
              <li>Your role doesn&apos;t have the required permission.</li>
              <li>You&apos;re trying to access another restaurant or outlet.</li>
              <li>Your access may have been changed by an administrator.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
            <Link
              href={dashboardUrl}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0038FF] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0025C5] transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Go to Dashboard
            </Link>

            <a
              href="mailto:support@thebistroos.com"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Headphones className="h-4 w-4 text-slate-500" />
              Contact Support
            </a>
          </div>
        </div>

        {/* Right Column: Illustration (Exact Match to 07-access-denied.png) */}
        <div className="relative w-full max-w-lg aspect-square lg:aspect-[4/3] flex items-center justify-center">
          <div className="relative w-full h-full min-h-[320px]">
            <Image
              src="/access-denied-illustration.png"
              alt="Access Denied Illustration"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-100">
        The Bistro OS Restaurant Management Platform • Role-Based Access Control
      </footer>
    </div>
  );
}
