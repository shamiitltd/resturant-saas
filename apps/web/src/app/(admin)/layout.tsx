import React from 'react';
import Link from 'next/link';
import { Shield, Building, CreditCard, Activity } from 'lucide-react';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Top Banner with Platform Admin Visual Identifier */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-xs">
        <div className="flex items-center gap-6">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#005CFE] text-white">
              <Shield className="h-4 w-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Super Admin Console</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              PLATFORM ROOT
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/admin/tenants"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              <Building className="h-4 w-4 text-blue-600" />
              Tenants
            </Link>
            <Link
              href="/admin/subscriptions"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              <CreditCard className="h-4 w-4" />
              Plans
            </Link>
            <Link
              href="/admin/audit"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              <Activity className="h-4 w-4" />
              Audit Logs
            </Link>
          </nav>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Privileged Admin Session
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
