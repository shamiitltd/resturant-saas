'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { publicFetch } from '@/lib/api';
import { CustomerCartProvider, useCustomerCart, CartModifier } from '@/lib/customer-cart';
import FoodDetailsModal from '../../components/FoodDetailsModal';
import {
  Search,
  SlidersHorizontal,
  Plus,
  ShoppingBag,
  ArrowRight,
  Loader2,
  AlertCircle,
  UtensilsCrossed,
  Check,
} from 'lucide-react';
import type { PublicMenuResponseDto, MenuItemDto, MenuCategoryDto } from '@restaurant-saas/contracts';

function CustomerMenuContent() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;

  const { session, setSession, addItem, totalItemCount, totalMinor, items: cartItems } = useCustomerCart();

  const [menu, setMenu] = useState<PublicMenuResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);

  // Active item for modal customization
  const [activeItemForModal, setActiveItemForModal] = useState<MenuItemDto | null>(null);

  // Fetch menu from live NestJS API
  useEffect(() => {
    if (!tenantSlug) return;

    let isMounted = true;
    async function loadMenu() {
      try {
        setLoading(true);
        setError(null);
        const data = await publicFetch<PublicMenuResponseDto>(`/v1/public/menu/${tenantSlug}`);
        if (!isMounted) return;
        setMenu(data);
        if (session && session.taxRatePercent !== data.taxRatePercent) {
          setSession({ ...session, taxRatePercent: data.taxRatePercent });
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Unable to load menu. Please ask staff for assistance.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadMenu();

    return () => {
      isMounted = false;
    };
  }, [tenantSlug]);

  // Filtered categories and items
  const filteredCategories = useMemo(() => {
    if (!menu) return [];

    return menu.categories
      .map((cat) => {
        const matchingItems = cat.items.filter((item) => {
          if (vegOnly && !item.isVegetarian) return false;
          if (
            searchQuery.trim() !== '' &&
            !item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !(item.description || '').toLowerCase().includes(searchQuery.toLowerCase())
          ) {
            return false;
          }
          return true;
        });

        return {
          ...cat,
          items: matchingItems,
        };
      })
      .filter((cat) => {
        if (selectedCategory !== 'all' && cat.id !== selectedCategory) {
          return false;
        }
        return cat.items.length > 0;
      });
  }, [menu, selectedCategory, searchQuery, vegOnly]);

  const handleItemAddClick = (item: MenuItemDto) => {
    // If item has modifiers or options, open customization modal
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setActiveItemForModal(item);
    } else {
      // Direct add to cart
      addItem(
        {
          id: item.id,
          name: item.name,
          isVegetarian: item.isVegetarian,
          basePriceMinor: item.basePriceMinor,
        },
        1,
        []
      );
    }
  };

  const handleModalAddToCart = (
    item: MenuItemDto,
    quantity: number,
    selectedModifiers: CartModifier[],
    notes?: string
  ) => {
    addItem(
      {
        id: item.id,
        name: item.name,
        isVegetarian: item.isVegetarian,
        basePriceMinor: item.basePriceMinor,
      },
      quantity,
      selectedModifiers,
      notes
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        <h3 className="mt-4 font-bold text-slate-800 text-lg">Loading Menu...</h3>
        <p className="mt-1 text-sm text-slate-500">Retrieving culinary selections</p>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="mt-3 font-bold text-slate-900 text-lg">Unable to Load Menu</h3>
        <p className="mt-1 text-sm text-slate-600">{error || 'Restaurant not found'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-orange-600 px-4 py-2 font-semibold text-sm text-white hover:bg-orange-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 pb-28">
      {/* Restaurant & Table Header */}
      <header className="rounded-2xl border border-orange-100 bg-white p-5 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-white">
                <UtensilsCrossed className="h-4 w-4" />
              </span>
              <h1 className="font-extrabold text-slate-900 text-xl tracking-tight">
                {menu.tenantName}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Freshly prepared to order • Contactless Table Service
            </p>
          </div>

          {/* Table Badge */}
          {session && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50/70 px-3.5 py-1.5 self-start sm:self-auto">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-left">
                <span className="block font-bold text-orange-950 text-xs">
                  {session.tableLabel} ({session.tableCode})
                </span>
                <span className="block text-[10px] text-orange-800 font-medium">Active Dine-in</span>
              </div>
            </div>
          )}
        </div>

        {/* Search & Veg Filter */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, starters, desserts..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={() => setVegOnly((v) => !v)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
              vegOnly
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-xs border border-emerald-600 p-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            </span>
            <span>Veg Only</span>
          </button>
        </div>
      </header>

      {/* Category Navigation Pills */}
      <nav className="sticky top-2 z-20 -mx-4 px-4 py-2 bg-slate-50/90 backdrop-blur-md overflow-x-auto scrollbar-none flex gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          All Items
        </button>
        {menu.categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              selectedCategory === cat.id
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {cat.name} ({cat.items.length})
          </button>
        ))}
      </nav>

      {/* Categories & Dish Cards */}
      <main className="mt-4 space-y-8">
        {filteredCategories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="font-medium text-slate-600 text-sm">No dishes found matching your search</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setVegOnly(false);
                setSelectedCategory('all');
              }}
              className="mt-3 text-xs font-bold text-orange-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredCategories.map((cat) => (
            <section key={cat.id} className="scroll-mt-20" id={`cat-${cat.id}`}>
              <div className="flex items-baseline justify-between mb-3 border-b border-slate-200/60 pb-2">
                <h2 className="font-extrabold text-slate-900 text-lg tracking-tight">
                  {cat.name}
                </h2>
                <span className="text-xs font-medium text-slate-500">
                  {cat.items.length} {cat.items.length === 1 ? 'dish' : 'dishes'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cat.items.map((item) => {
                  const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0;
                  const itemInCartCount = cartItems
                    .filter((ci) => ci.itemId === item.id)
                    .reduce((sum, ci) => sum + ci.quantity, 0);

                  return (
                    <div
                      key={item.id}
                      className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-orange-200 hover:shadow-md"
                    >
                      <div>
                        {/* Veg / Non-Veg Indicator */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-xs border p-0.5 ${
                              item.isVegetarian ? 'border-emerald-600' : 'border-red-600'
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                item.isVegetarian ? 'bg-emerald-600' : 'bg-red-600'
                              }`}
                            />
                          </span>

                          {item.prepTimeMinutes && (
                            <span className="text-[11px] font-medium text-slate-400">
                              ~{item.prepTimeMinutes} mins
                            </span>
                          )}
                        </div>

                        {/* Dish Details */}
                        <h3 className="font-bold text-slate-900 text-base group-hover:text-orange-950">
                          {item.name}
                        </h3>

                        <div className="mt-1 font-extrabold text-slate-900 text-sm">
                          ₹{(item.basePriceMinor / 100).toFixed(2)}
                        </div>

                        {item.description && (
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                        {itemInCartCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                            {itemInCartCount} in cart
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {hasModifiers ? 'Customizable' : 'Standard'}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleItemAddClick(item)}
                          className={`flex items-center gap-1 rounded-xl px-3.5 py-1.5 font-bold text-xs transition ${
                            hasModifiers
                              ? 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                              : 'bg-orange-600 text-white shadow-xs hover:bg-orange-700'
                          }`}
                        >
                          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>{hasModifiers ? 'Customize' : 'Add'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl">
          <button
            type="button"
            onClick={() => router.push(`/${tenantSlug}/cart`)}
            className="flex w-full items-center justify-between rounded-2xl bg-orange-600 px-5 py-3.5 text-white shadow-xl shadow-orange-600/30 transition hover:bg-orange-700 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div className="text-left">
                <span className="block font-extrabold text-sm leading-tight">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                </span>
                <span className="block text-xs text-orange-100 font-medium leading-tight">
                  ₹{(totalMinor / 100).toFixed(2)} (incl. taxes)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 font-bold text-sm">
              <span>View Cart</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>
        </div>
      )}

      {/* Customization Modal */}
      {activeItemForModal && (
        <FoodDetailsModal
          item={activeItemForModal}
          onClose={() => setActiveItemForModal(null)}
          onAddToCart={handleModalAddToCart}
        />
      )}
    </div>
  );
}

export default function CustomerMenuPage() {
  const params = useParams();
  const tenantSlug = params.tenantSlug as string;

  return (
    <CustomerCartProvider tenantSlug={tenantSlug}>
      <CustomerMenuContent />
    </CustomerCartProvider>
  );
}
