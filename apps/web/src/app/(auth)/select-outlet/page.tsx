'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import { AuthHeroPanel } from '@/components/AuthHeroPanel';
import {
  Store,
  MapPin,
  User,
  Zap,
  Search,
  Check,
  ArrowRight,
  Loader2,
  AlertCircle,
  ChevronDown,
  Building2,
  ChefHat,
  UtensilsCrossed,
  LogOut,
} from 'lucide-react';
import type { AuthMeResponseDto, ActiveMembershipDto } from '@restaurant-saas/contracts';

const SELECT_WORKSPACE_FEATURES = [
  { icon: Store, label: 'Switch between restaurants' },
  { icon: MapPin, label: 'Manage multiple outlets' },
  { icon: User, label: 'Access based on your role' },
  { icon: Zap, label: 'A single login, multiple workspaces' },
];

interface RestaurantCardData {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  membershipId: string;
  primaryRole: string;
  outletCount: number;
  cuisines: string;
  iconType: 'chef' | 'burger' | 'leaf';
  locations: Array<{
    id: string;
    code: string;
    name: string;
    address?: string;
    isPrimary: boolean;
  }>;
}

export default function SelectOutletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // User profile
  const [userName, setUserName] = useState('Staff Account');
  const [userRole, setUserRole] = useState('Account Access');
  const [userInitials, setUserInitials] = useState('RA');

  // Multi-tenant data
  const [restaurants, setRestaurants] = useState<RestaurantCardData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setErrorMessage(null);

        // 1. Ensure active Supabase session
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // 2. Check for pending owner onboarding from registration
        const pending = localStorage.getItem('pending_owner_onboarding');
        if (pending) {
          try {
            const payload = JSON.parse(pending);
            await fetchWithAuth<AuthMeResponseDto>('/v1/auth/register-owner', {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            localStorage.removeItem('pending_owner_onboarding');
            localStorage.removeItem('pending_owner_password');
            router.push('/owner/dashboard');
            return;
          } catch (onboardingErr: any) {
            console.warn('Pending onboarding resolution error:', onboardingErr);
          }
        }

        // 3. Load user profile & memberships
        const profile = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');

        // Extract display name & initials
        const fullName =
          profile.user.fullName ||
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'Restaurant User';
        setUserName(fullName);

        const initials = fullName
          .split(' ')
          .map((n: string) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || 'RA';
        setUserInitials(initials);

        if (profile.memberships.length === 0) {
          setRestaurants([]);
          setLoading(false);
          return;
        }

        // Map memberships into restaurant cards
        const restaurantList: RestaurantCardData[] = profile.memberships.map((m, idx) => {
          const primaryRole = m.roles[0]?.name || 'Staff';
          const iconTypes: Array<'chef' | 'burger' | 'leaf'> = ['chef', 'burger', 'leaf'];
          return {
            tenantId: m.tenantId,
            tenantName: m.tenantName,
            tenantSlug: m.tenantSlug,
            membershipId: m.membershipId,
            primaryRole,
            outletCount: m.locations.length,
            cuisines: m.locations.length > 1 ? 'Multi-Outlet • Full Service' : 'Single Outlet • Dining',
            iconType: iconTypes[idx % iconTypes.length],
            locations: m.locations.map((loc) => ({
              id: loc.id,
              code: loc.code,
              name: loc.name,
              address: `Location code: ${loc.code}`,
              isPrimary: loc.isPrimary,
            })),
          };
        });

        setRestaurants(restaurantList);

        // Determine user display role
        const firstRole = restaurantList[0]?.primaryRole || 'Staff';
        setUserRole(`${firstRole} Account`);

        // Default selection: first restaurant and its primary location
        if (restaurantList.length > 0) {
          const firstRest = restaurantList[0];
          setSelectedTenantId(firstRest.tenantId);
          const defaultLoc = firstRest.locations.find((l) => l.isPrimary) || firstRest.locations[0];
          if (defaultLoc) {
            setSelectedLocationId(defaultLoc.id);
          }
        }
      } catch (err: any) {
        if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
          router.push('/login');
          return;
        }
        setErrorMessage(err.message || 'Failed to load authorized restaurants and outlets.');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  // Currently selected restaurant
  const currentRestaurant = useMemo(() => {
    return restaurants.find((r) => r.tenantId === selectedTenantId) || restaurants[0] || null;
  }, [restaurants, selectedTenantId]);

  // Outlets for currently selected restaurant
  const currentOutlets = useMemo(() => {
    return currentRestaurant ? currentRestaurant.locations : [];
  }, [currentRestaurant]);

  // Filter restaurants by search query
  const filteredRestaurants = useMemo(() => {
    if (!searchQuery.trim()) return restaurants;
    const q = searchQuery.toLowerCase().trim();
    return restaurants.filter(
      (r) =>
        r.tenantName.toLowerCase().includes(q) ||
        r.cuisines.toLowerCase().includes(q) ||
        r.locations.some((l) => l.name.toLowerCase().includes(q))
    );
  }, [restaurants, searchQuery]);

  const handleSelectRestaurant = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    const targetRest = restaurants.find((r) => r.tenantId === tenantId);
    if (targetRest && targetRest.locations.length > 0) {
      const defaultLoc = targetRest.locations.find((l) => l.isPrimary) || targetRest.locations[0];
      setSelectedLocationId(defaultLoc.id);
    } else {
      setSelectedLocationId(null);
    }
  };

  const handleContinue = async () => {
    if (!currentRestaurant || !selectedLocationId) {
      setErrorMessage('Please select both a restaurant and an outlet to continue.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await fetchWithAuth('/v1/auth/select-outlet', {
        method: 'POST',
        body: JSON.stringify({
          membershipId: currentRestaurant.membershipId,
          locationId: selectedLocationId,
        }),
      });

      // Navigate based on primary role
      const roleLower = currentRestaurant.primaryRole.toLowerCase();
      if (roleLower.includes('owner') || roleLower.includes('admin')) {
        router.push('/owner/dashboard');
      } else if (roleLower.includes('chef')) {
        router.push('/staff/kitchen');
      } else if (roleLower.includes('waiter')) {
        router.push('/staff/waiter');
      } else {
        router.push('/staff/reception');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to activate workspace context.');
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen w-full bg-[#F8FAFC]">
      {/* Left Branded Hero Panel (Exact Match to 06-select-restaurant-outlet.png) */}
      <AuthHeroPanel
        className="hidden lg:flex lg:w-[42%] xl:w-[38%]"
        titlePrefix="Choose your"
        titleHighlight="workspace"
        subtitle="You're associated with multiple restaurants or outlets. Select where you want to continue."
        features={SELECT_WORKSPACE_FEATURES}
        footerBadge="Enterprise Multi-Tenant Isolation"
      />

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 overflow-y-auto">
        {/* Top Header Row with User Avatar Chip */}
        <div className="flex items-center justify-between pb-8 border-b border-slate-100">
          <div className="lg:hidden flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF4500] to-[#FF6B35] text-white font-bold text-sm shadow-sm">
              BO
            </div>
            <span className="font-bold text-slate-900 text-sm">The Bistro OS</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-xs">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DCE8FF] text-[#0038FF] font-bold text-xs">
                {userInitials}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight">{userName}</p>
                <p className="text-[11px] text-slate-500 leading-tight">{userRole}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="text-slate-400 hover:text-red-600 transition ml-1"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="max-w-4xl w-full my-auto py-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Select Restaurant & Outlet
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Choose the restaurant and outlet you want to work with.
            </p>
          </div>

          {errorMessage && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-[#0038FF] mb-3" />
              <p className="text-sm font-medium">Loading your authorized workspaces...</p>
            </div>
          ) : restaurants.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0038FF]">
                <Store className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">No active restaurant assignments</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Your account does not have any active restaurant outlets assigned yet. If you are an owner,
                you can register your restaurant now.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0038FF] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0025C5] transition"
                >
                  Register Restaurant
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {/* 1. SELECT RESTAURANT */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h2 className="text-base font-bold text-slate-900">Select Restaurant</h2>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search restaurants..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 focus:border-[#0038FF] transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRestaurants.map((r) => {
                    const isSelected = selectedTenantId === r.tenantId;
                    return (
                      <div
                        key={r.tenantId}
                        onClick={() => handleSelectRestaurant(r.tenantId)}
                        className={`relative rounded-2xl p-4 transition cursor-pointer border ${
                          isSelected
                            ? 'bg-[#EEF4FF] border-[#0038FF] ring-2 ring-[#0038FF]/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-3.5 right-3.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#0038FF] text-white">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-xs ${
                              r.iconType === 'chef'
                                ? 'bg-rose-100 text-rose-700'
                                : r.iconType === 'burger'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {r.iconType === 'chef' ? (
                              <ChefHat className="h-5 w-5" />
                            ) : r.iconType === 'burger' ? (
                              <Store className="h-5 w-5" />
                            ) : (
                              <UtensilsCrossed className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 leading-tight">
                              {r.tenantName}
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                              {r.outletCount} {r.outletCount === 1 ? 'Outlet' : 'Outlets'} •{' '}
                              {r.primaryRole}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. SELECT OUTLET */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-900">Select Outlet</h2>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {currentOutlets.length} {currentOutlets.length === 1 ? 'outlet' : 'outlets'} available
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {currentOutlets.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                      No outlets found for this restaurant.
                    </div>
                  ) : (
                    currentOutlets.map((outlet) => {
                      const isSelected = selectedLocationId === outlet.id;
                      return (
                        <div
                          key={outlet.id}
                          onClick={() => setSelectedLocationId(outlet.id)}
                          className={`flex items-center justify-between p-4 rounded-xl border transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#EEF4FF] border-[#0038FF] ring-2 ring-[#0038FF]/20 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                                isSelected
                                  ? 'bg-blue-100 text-[#0038FF]'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                {outlet.name}
                                {outlet.isPrimary && (
                                  <span className="ml-2 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#0038FF]">
                                    Primary
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {outlet.address || `Code: ${outlet.code}`}
                              </p>
                            </div>
                          </div>

                          {/* Radio circle indicator */}
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full transition ${
                              isSelected
                                ? 'bg-[#0038FF] text-white'
                                : 'border-2 border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action Button: Continue to Dashboard */}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={submitting || !selectedLocationId}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0038FF] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0025C5] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/40 disabled:opacity-50 transition"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Activating Workspace...
                    </>
                  ) : (
                    <>
                      Continue to Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
          The Bistro OS Restaurant Management Platform • Multi-Tenant Isolation
        </div>
      </div>
    </div>
  );
}
