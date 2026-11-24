'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import { BistroLogo } from '@/components/BistroLogo';
import {
  Crown,
  Home,
  BarChart2,
  UtensilsCrossed,
  BookOpen,
  Users2,
  Layers,
  Store,
  HeartHandshake,
  GitFork,
  Settings,
  Bell,
  Calendar,
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  X,
} from 'lucide-react';
import type { AuthMeResponseDto } from '@restaurant-saas/contracts';

const OWNER_NAV_ITEMS = [
  { href: '/owner/dashboard', label: 'Overview', icon: Home },
  { href: '/owner/sales', label: 'Sales & Reports', icon: BarChart2 },
  { href: '/owner/menu', label: 'Menu Management', icon: UtensilsCrossed },
  { href: '/owner/inventory', label: 'Inventory', icon: BookOpen },
  { href: '/owner/staff', label: 'Staff & Roles', icon: Users2 },
  { href: '/owner/tables', label: 'Tables & Reservations', icon: Layers },
  { href: '/owner/marketplace', label: 'Marketplace', icon: Store },
  { href: '/owner/loyalty', label: 'Customers & Loyalty', icon: HeartHandshake },
  { href: '/owner/outlets', label: 'Outlets & Branches', icon: GitFork },
  { href: '/owner/integrations', label: 'Integrations', icon: GitFork },
  { href: '/owner/settings', label: 'Settings', icon: Settings },
];

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [restaurantName, setRestaurantName] = useState('Spice Garden');
  const [outletName, setOutletName] = useState('All Outlets');
  const [userName, setUserName] = useState('Raghav Aggarwal');
  const [userInitial, setUserInitial] = useState('R');

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const profile = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');
        if (profile.memberships.length > 0) {
          const m = profile.memberships[0];
          setRestaurantName(m.tenantName || 'The Bistro');
          if (m.locations.length > 0) {
            setOutletName(m.locations[0].name);
          }
        }
        const name = profile.user.fullName || session.user.user_metadata?.full_name || 'Owner';
        setUserName(name);
        setUserInitial(name.charAt(0).toUpperCase() || 'R');
      } catch (err) {
        console.warn('Failed to load owner profile in layout:', err);
      }
    }
    loadProfile();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen w-full bg-[#F8FAFC]" suppressHydrationWarning>
      {/* Left Sidebar (Fixed 256px, locked strictly on the left side matching 01-owner-dashboard-overview.png) */}
      <aside
        suppressHydrationWarning
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-[#181111] text-slate-300 flex flex-col justify-between p-4 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-4">
          {/* Top Logo & App Name */}
          <div className="flex items-center justify-between px-2 pt-2">
            <BistroLogo theme="light" size="sm" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              suppressHydrationWarning
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Owner Dashboard Pill Badge */}
          <div className="px-1">
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 shadow-xs">
              <Crown className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Owner Dashboard</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-medium pt-1 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
            {OWNER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href === '/owner/dashboard' && pathname === '/dashboard');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition ${
                    isActive
                      ? 'bg-[#FF4E00] text-white font-bold shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Pill */}
        <div className="border-t border-white/10 pt-3">
          <div className="flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-white/5 transition">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFEAD8] text-[#EA580C] font-bold text-xs shadow-xs">
                {userInitial}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                  {userName}
                </p>
                <p className="text-[11px] text-slate-400 leading-tight">Owner</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign Out"
              suppressHydrationWarning
              className="text-slate-400 hover:text-red-400 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden" suppressHydrationWarning>
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40" suppressHydrationWarning>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              suppressHydrationWarning
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Outlet Selector Dropdown Pill */}
            <Link
              href="/select-outlet"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition"
            >
              <MapPin className="h-3.5 w-3.5 text-[#FF4E00]" />
              <span>{restaurantName} – {outletName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <button
              type="button"
              suppressHydrationWarning
              className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#FF4E00]" />
            </button>

            {/* Date Range Selector Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>Last 7 Days (8 Nov – 14 Nov 2026)</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
            </div>

            {/* User Avatar Circle */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFEAD8] text-[#EA580C] font-bold text-xs shadow-xs">
              {userInitial}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto" suppressHydrationWarning>
          {children}
        </main>
      </div>
    </div>
  );
}
