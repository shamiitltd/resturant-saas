'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChefHat, ClipboardList, User, Receipt, MapPin, LogOut, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import type { AuthMeResponseDto } from '@restaurant-saas/contracts';

interface StationLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const ALL_STATIONS: StationLink[] = [
  {
    href: '/staff/reception',
    label: 'Reception',
    icon: ClipboardList,
    roles: ['RECEPTIONIST', 'MANAGER', 'OWNER', 'PLATFORM_ADMIN'],
  },
  {
    href: '/staff/reservations',
    label: 'Reservations',
    icon: Calendar,
    roles: ['RECEPTIONIST', 'MANAGER', 'OWNER', 'WAITER', 'PLATFORM_ADMIN'],
  },
  {
    href: '/staff/billing',
    label: 'Billing',
    icon: Receipt,
    roles: ['RECEPTIONIST', 'MANAGER', 'OWNER', 'PLATFORM_ADMIN'],
  },
  {
    href: '/staff/kitchen',
    label: 'KDS',
    icon: ChefHat,
    roles: ['CHEF', 'MANAGER', 'OWNER', 'PLATFORM_ADMIN'],
  },
  {
    href: '/staff/waiter',
    label: 'Waiter',
    icon: User,
    roles: ['WAITER', 'MANAGER', 'OWNER', 'PLATFORM_ADMIN'],
  },
];

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Staff');
  const [userRole, setUserRole] = useState<string>('STAFF');
  const [outletName, setOutletName] = useState<string>('Main Outlet');
  const [allowedStations, setAllowedStations] = useState<StationLink[]>([]);

  useEffect(() => {
    async function checkAuthAndRole() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace('/login');
          return;
        }

        const profile = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');
        if (profile.memberships.length > 0) {
          const m = profile.memberships[0];
          try {
            localStorage.setItem('staff_tenant_id', m.tenantId);
            if (m.locations.length > 0) {
              localStorage.setItem('staff_location_id', m.locations[0].id);
            }
          } catch {}
        }

        const role = profile.isPlatformAdmin
          ? 'PLATFORM_ADMIN'
          : profile.memberships[0]?.roles[0]?.code?.toUpperCase() ||
            profile.memberships[0]?.roles[0]?.name?.toUpperCase() ||
            'STAFF';

        const name =
          profile.user.fullName ||
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'Staff';

        const location =
          profile.memberships[0]?.locations[0]?.name || 'Main Outlet';

        setUserName(name);
        setUserRole(role);
        setOutletName(location);

        // Filter permitted stations based on user's role
        const permitted = ALL_STATIONS.filter(
          (s) => s.roles.includes(role) || role === 'PLATFORM_ADMIN' || role === 'OWNER' || role === 'MANAGER'
        );
        setAllowedStations(permitted);

        // Enforce RBAC station routing:
        // If user is a CHEF, they cannot access /staff/reception or /staff/waiter
        if (role === 'CHEF') {
          if (pathname.includes('/reception') || pathname.includes('/waiter')) {
            router.replace('/staff/kitchen');
            return;
          }
        } else if (role === 'WAITER') {
          if (pathname.includes('/kitchen') || pathname.includes('/reception')) {
            router.replace('/staff/waiter');
            return;
          }
        } else if (role === 'RECEPTIONIST') {
          if (pathname.includes('/kitchen')) {
            router.replace('/staff/reception');
            return;
          }
        }

        setLoading(false);
      } catch (err) {
        console.warn('Failed to resolve staff profile in layout:', err);
        setLoading(false);
      }
    }

    checkAuthAndRole();
  }, [pathname, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const isCurrentActive = (href: string) => {
    if (href === '/staff/kitchen' && (pathname === '/kitchen' || pathname === '/staff/kitchen')) return true;
    if (href === '/staff/reception' && (pathname === '/reception' || pathname === '/staff/reception')) return true;
    if (href === '/staff/billing' && (pathname === '/billing' || pathname === '/staff/billing')) return true;
    if (href === '/staff/waiter' && (pathname === '/waiter' || pathname === '/staff/waiter')) return true;
    return pathname.startsWith(href);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* High-density Operational Top Bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-xs">
        <div className="flex items-center gap-6">
          <Link href={allowedStations[0]?.href || '/staff/kitchen'} className="flex items-center gap-2">
            <span className="rounded-md bg-orange-600 px-2 py-0.5 text-xs font-black tracking-wider text-white">
              OPS
            </span>
            <span className="font-bold text-slate-900 text-sm hidden sm:inline">Staff Operations</span>
          </Link>

          {/* Quick Station Navigation (Filtered by Staff Role) */}
          <nav className="flex items-center gap-1.5 text-xs font-semibold">
            {allowedStations.map((station) => {
              const Icon = station.icon;
              const active = isCurrentActive(station.href);
              return (
                <Link
                  key={station.href}
                  href={station.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                    active
                      ? 'bg-orange-50 text-orange-600 font-bold border border-orange-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{station.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Branch Context, User Role & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
            <MapPin className="h-3.5 w-3.5 text-orange-600" />
            <span className="truncate max-w-[140px]">{outletName}</span>
          </div>

          {/* Role Badge */}
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200 uppercase tracking-wider">
            {userRole}
          </span>

          <span className="text-xs font-medium text-slate-600 hidden md:inline">
            {userName}
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Operational Area */}
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
