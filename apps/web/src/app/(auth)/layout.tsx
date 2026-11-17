import React from 'react';
import Link from 'next/link';
import { UtensilsCrossed, ShieldCheck, Clock, Users } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left Branded Hero Panel (Hidden on mobile, visible on desktop >= 1024px) */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between bg-[#08172F] p-12 text-white relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-orange-600/10 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 shadow-md">
              <UtensilsCrossed className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">RestoSaaS</span>
              <span className="block text-xs text-slate-400 font-medium tracking-wider uppercase">Operating Platform</span>
            </div>
          </Link>
        </div>

        {/* Center Presentation Graphic & Tagline */}
        <div className="relative z-10 my-auto space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-orange-400 backdrop-blur-md">
            <span>v1.1 Multi-Tenant Platform</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Streamline Kitchen, Service & Restaurant Operations
          </h1>

          <p className="text-sm leading-relaxed text-slate-300">
            From QR-based dining orders and chef KDS queues to consolidated table billing and multi-branch management.
          </p>

          {/* Quick Feature Pillars */}
          <div className="grid grid-cols-1 gap-3.5 pt-4">
            <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3 text-xs text-slate-200">
              <Clock className="h-4 w-4 text-orange-500 shrink-0" />
              <span>Realtime kitchen tickets & chef ETA updates</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3 text-xs text-slate-200">
              <Users className="h-4 w-4 text-blue-400 shrink-0" />
              <span>Multi-branch RBAC for reception, chefs & waiters</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3 text-xs text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Strict tenant isolation & Supabase Row-Level Security</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-400 flex justify-between items-center border-t border-white/10 pt-6">
          <span>© 2026 RestoSaaS Inc.</span>
          <span>Enterprise Grade Isolation</span>
        </div>
      </div>

      {/* Right Content Column (Form Canvas) */}
      <div className="flex w-full lg:w-7/12 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 bg-white">
        <div className="mx-auto w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
