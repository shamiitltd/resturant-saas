import React from 'react';
import Link from 'next/link';
import { ChefHat, ClipboardList, Receipt, Bell, User, MapPin } from 'lucide-react';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* High-density Operational Top Bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-xs">
        <div className="flex items-center gap-6">
          <Link href="/staff/reception" className="flex items-center gap-2">
            <span className="rounded-md bg-orange-600 px-2 py-0.5 text-xs font-black tracking-wider text-white">
              OPS
            </span>
            <span className="font-bold text-slate-900 text-sm">Staff Operations</span>
          </Link>

          {/* Quick Station Navigation */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/staff/reception"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            >
              <ClipboardList className="h-4 w-4" />
              Reception
            </Link>
            <Link
              href="/staff/kitchen"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            >
              <ChefHat className="h-4 w-4" />
              KDS
            </Link>
            <Link
              href="/staff/waiter"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            >
              <User className="h-4 w-4" />
              Waiter
            </Link>
          </nav>
        </div>

        {/* Branch Context & Alerts */}
        <div className="flex items-center gap-3">
          <Link
            href="/select-outlet"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <MapPin className="h-3.5 w-3.5 text-orange-600" />
            <span>Switch Outlet</span>
          </Link>
          <button
            type="button"
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-600" />
          </button>
        </div>
      </header>

      {/* Main Operational Area */}
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
