import React from 'react';
import Link from 'next/link';
import { Utensils, ShoppingBag } from 'lucide-react';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-lg">
      {/* Mobile-first Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-orange-100 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white">
            <Utensils className="h-4 w-4" />
          </div>
          <span className="font-bold text-slate-900 text-sm">Table Order</span>
        </div>
        <Link
          href="#cart"
          className="relative flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-600"
        >
          <ShoppingBag className="h-4 w-4" />
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-16">{children}</main>
    </div>
  );
}
