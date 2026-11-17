import React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Layers,
  Tag,
  Users,
  Settings,
  ChevronDown,
} from 'lucide-react';

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between p-4 hidden md:flex">
        <div className="space-y-6">
          {/* Tenant Brand Header */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FD5001] text-white shadow-xs font-black">
              R
            </div>
            <div>
              <span className="block text-sm font-bold text-slate-900 leading-tight">Owner Portal</span>
              <span className="block text-xs text-slate-500">Business Control</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-semibold">
            <Link
              href="/owner/dashboard"
              className="flex items-center gap-2.5 rounded-lg bg-orange-50 px-3 py-2 text-orange-700"
            >
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </Link>
            <Link
              href="/owner/menu"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              <UtensilsCrossed className="h-4 w-4" />
              Menu & Pricing
            </Link>
            <Link
              href="/owner/tables"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              <Layers className="h-4 w-4" />
              Tables & QR Codes
            </Link>
            <Link
              href="/owner/offers"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              <Tag className="h-4 w-4" />
              Offers & Promotions
            </Link>
            <Link
              href="/owner/team"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              <Users className="h-4 w-4" />
              Staff & Permissions
            </Link>
          </nav>
        </div>

        {/* Bottom Outlet Switcher */}
        <div className="border-t border-slate-200 pt-4">
          <Link
            href="/select-outlet"
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <span>Switch Outlet</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
