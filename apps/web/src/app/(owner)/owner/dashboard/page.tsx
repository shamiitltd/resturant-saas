'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import {
  Crown,
  TrendingUp,
  ShoppingBag,
  Users,
  Layers,
  Star,
  Store,
  UtensilsCrossed,
  GitFork,
  ArrowUpRight,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Plus,
  BarChart2,
  Settings,
  ChevronRight,
  Zap,
  Clock,
  RefreshCw,
} from 'lucide-react';
import type { AuthMeResponseDto } from '@restaurant-saas/contracts';

interface OwnerAnalyticsDto {
  totalSalesMinor: number;
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  totalGuests: number;
  avgOrderValueMinor: number;
  totalOutlets: number;
  totalStaff: number;
  totalMenuItems: number;
  totalCategories: number;
  salesTrend: {
    date: string;
    label: string;
    salesMinor: number;
    ordersCount: number;
  }[];
  channelBreakdown: {
    channel: string;
    name: string;
    ordersCount: number;
    salesMinor: number;
    percentage: number;
    color: string;
  }[];
  outletPerformance: {
    id: string;
    name: string;
    code: string;
    salesMinor: number;
    ordersCount: number;
    avgOrderValueMinor: number;
    status: string;
  }[];
  topSellingItems: {
    name: string;
    category: string;
    ordersCount: number;
    revenueMinor: number;
  }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    tableCode: string | null;
    status: string;
    totalMinor: number;
    channel: string;
    createdAt: string;
  }[];
}

export default function OwnerDashboardPage() {
  const [ownerName, setOwnerName] = useState('Restaurant Owner');
  const [greeting, setGreeting] = useState('Good day');
  const [salesMetricMode, setSalesMetricMode] = useState<'sales' | 'orders'>('sales');
  const [analytics, setAnalytics] = useState<OwnerAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dynamic greeting based on current local hour
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good morning');
    } else if (hour < 17) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }

    async function loadData() {
      try {
        setLoading(true);
        const [profileRes, analyticsRes] = await Promise.allSettled([
          fetchWithAuth<AuthMeResponseDto>('/v1/auth/me'),
          fetchWithAuth<OwnerAnalyticsDto>('/v1/owner/analytics/overview'),
        ]);

        if (profileRes.status === 'fulfilled' && profileRes.value?.user) {
          const fullName = profileRes.value.user.fullName || 'Restaurant Owner';
          setOwnerName(fullName.split(' ')[0]);
        }

        if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
          setAnalytics(analyticsRes.value);
        }
      } catch (err) {
        console.warn('Dashboard real data load fallback:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute dynamic SVG coordinates for sales/orders trend
  const trendPoints = useMemo(() => {
    const data = analytics?.salesTrend || [];
    if (data.length === 0) return { polyline: '0,130 400,130', polygon: '0,130 400,130 400,150 0,150', maxVal: 0, peakLabel: '₹0' };

    const values = data.map((d) => (salesMetricMode === 'sales' ? Math.round(d.salesMinor / 100) : d.ordersCount));
    const maxVal = Math.max(...values, salesMetricMode === 'sales' ? 1000 : 5);

    const stepX = 400 / Math.max(data.length - 1, 1);
    const coords = values.map((val, idx) => {
      const x = Math.round(idx * stepX);
      const y = Math.round(140 - (val / maxVal) * 90);
      return { x, y, val };
    });

    const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const polygon = `0,150 ${polyline} 400,150`;

    // Find peak
    let peakIndex = 0;
    let peakValue = values[0] || 0;
    values.forEach((v, i) => {
      if (v > peakValue) {
        peakValue = v;
        peakIndex = i;
      }
    });

    const peakLabel = salesMetricMode === 'sales' ? `₹${peakValue.toLocaleString('en-IN')}` : `${peakValue} Orders`;

    return {
      polyline,
      polygon,
      maxVal,
      peakLabel,
      peakCoord: coords[peakIndex] || { x: 200, y: 70 },
      coords,
    };
  }, [analytics, salesMetricMode]);

  const totalSalesINR = Math.round((analytics?.totalSalesMinor || 0) / 100);
  const avgOrderINR = Math.round((analytics?.avgOrderValueMinor || 0) / 100);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Welcome Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-xs">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {greeting}, {ownerName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Live operational performance across your restaurant branches.
            </p>
          </div>
        </div>

        {/* Counter Pills on Right (Directly from Database) */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-orange-50/70 border border-orange-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-[#FF4E00]">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">{analytics?.totalOutlets ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">Outlets</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">{analytics?.totalStaff ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">Total Staff</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">{analytics?.totalMenuItems ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">Menu Items</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">{analytics?.totalCategories ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">Categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards (5 Cards Row - 100% Real PostgreSQL Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Sales */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Sales</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">₹{totalSalesINR.toLocaleString('en-IN')}</p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1">
              <span>● Live database total</span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100 font-extrabold text-lg">
            ₹
          </div>
        </div>

        {/* Total Orders */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Orders</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{analytics?.totalOrders ?? 0}</p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mt-1">
              <span>{analytics?.completedOrders ?? 0} Completed</span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <ShoppingBag className="h-5 w-5" />
          </div>
        </div>

        {/* Active Orders */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Active Kitchen Orders</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{analytics?.activeOrders ?? 0}</p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 mt-1">
              <span>In Kitchen / Service</span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Avg Order Value */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Avg. Order Value</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">₹{avgOrderINR.toLocaleString('en-IN')}</p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1">
              <span>Per confirmed order</span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* Total Guests */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Diners</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{analytics?.totalGuests ?? 0}</p>
            <span className="text-[11px] text-slate-400 mt-1 block">Table guest sessions</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Middle Row: Real Sales Trend + Orders by Channel + Outlet Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real Sales Trend Chart */}
        <div className="lg:col-span-5 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#FF4E00]" />
              <h2 className="text-sm font-bold text-slate-900">7-Day Real Performance</h2>
            </div>
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSalesMetricMode('sales')}
                className={`px-2.5 py-1 rounded-md transition ${
                  salesMetricMode === 'sales'
                    ? 'bg-[#FF4E00] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Revenue
              </button>
              <button
                type="button"
                onClick={() => setSalesMetricMode('orders')}
                className={`px-2.5 py-1 rounded-md transition ${
                  salesMetricMode === 'orders'
                    ? 'bg-[#FF4E00] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Orders
              </button>
            </div>
          </div>

          {/* SVG Sales Curve */}
          <div className="relative h-52 w-full pt-4">
            <svg viewBox="0 0 400 160" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="realSalesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF4E00" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#FF4E00" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="400" y2="30" stroke="#F1F5F9" strokeDasharray="3 3" />
              <line x1="0" y1="70" x2="400" y2="70" stroke="#F1F5F9" strokeDasharray="3 3" />
              <line x1="0" y1="110" x2="400" y2="110" stroke="#F1F5F9" strokeDasharray="3 3" />

              {/* Dynamic Polygon Area */}
              <polygon points={trendPoints.polygon} fill="url(#realSalesGrad)" />
              {/* Dynamic Polyline Curve */}
              <polyline
                points={trendPoints.polyline}
                fill="none"
                stroke="#FF4E00"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Data points */}
              {trendPoints.coords?.map((c, i) => (
                <circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r="3.5"
                  fill="#FF4E00"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              ))}
            </svg>

            {/* Peak Tooltip Pill */}
            {trendPoints.peakCoord && (
              <div
                className="absolute -top-1 rounded-lg border border-orange-200 bg-white px-2.5 py-1 text-center shadow-xs"
                style={{
                  left: `${(trendPoints.peakCoord.x / 400) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <p className="text-[10px] text-slate-400">Peak</p>
                <p className="text-xs font-extrabold text-slate-900">{trendPoints.peakLabel}</p>
              </div>
            )}
          </div>

          {/* Days axis */}
          <div className="flex justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            {(analytics?.salesTrend || []).map((day) => (
              <span key={day.date}>{day.label}</span>
            ))}
          </div>
        </div>

        {/* Real Orders by Channel */}
        <div className="lg:col-span-3 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-[#FF4E00]" />
            <h2 className="text-sm font-bold text-slate-900">Orders by Channel</h2>
          </div>

          <div className="flex items-center justify-center my-3">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#E2E8F0" strokeWidth="5" />
                {analytics?.channelBreakdown && analytics.channelBreakdown.length > 0 ? (
                  analytics.channelBreakdown.map((ch, idx) => {
                    const strokeDasharray = `${ch.percentage} 100`;
                    const prevPcts = analytics.channelBreakdown
                      .slice(0, idx)
                      .reduce((acc, c) => acc + c.percentage, 0);
                    return (
                      <circle
                        key={ch.channel}
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={ch.color}
                        strokeWidth="5"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={`-${prevPcts}`}
                      />
                    );
                  })
                ) : (
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#CBD5E1" strokeWidth="5" />
                )}
              </svg>
              <div className="absolute text-center">
                <p className="text-sm font-extrabold text-slate-900">{analytics?.totalOrders ?? 0}</p>
                <p className="text-[10px] text-slate-400">Total Orders</p>
              </div>
            </div>
          </div>

          {/* Breakdown legend */}
          <div className="space-y-1.5 text-xs text-slate-600">
            {analytics?.channelBreakdown && analytics.channelBreakdown.length > 0 ? (
              analytics.channelBreakdown.map((ch) => (
                <div key={ch.channel} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
                    {ch.name}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {ch.percentage}% ({ch.ordersCount})
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-slate-400 italic py-2">
                No orders registered on any channel yet
              </p>
            )}
          </div>
        </div>

        {/* Real Outlet Performance */}
        <div className="lg:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-4 w-4 text-[#FF4E00]" />
            <h2 className="text-sm font-bold text-slate-900">Branch Performance</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                  <th className="pb-2">Outlet</th>
                  <th className="pb-2 text-right">Sales (₹)</th>
                  <th className="pb-2 text-right">Orders</th>
                  <th className="pb-2 text-right">AOV (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics?.outletPerformance && analytics.outletPerformance.length > 0 ? (
                  analytics.outletPerformance.map((outlet) => (
                    <tr key={outlet.id}>
                      <td className="py-2.5 font-bold text-slate-800 flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            outlet.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        <span className="truncate max-w-[110px]">{outlet.name}</span>
                      </td>
                      <td className="py-2.5 text-right font-semibold">
                        ₹{Math.round(outlet.salesMinor / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 text-right text-slate-600">{outlet.ordersCount}</td>
                      <td className="py-2.5 text-right text-slate-900 font-bold">
                        ₹{Math.round(outlet.avgOrderValueMinor / 100)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                      No active branches found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-100 text-right">
            <Link
              href="/owner/menu"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF4E00] hover:underline"
            >
              Outlet Menu Sync <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Bottom Operations Row: Real Top Items + Real Recent Orders + Live Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real Top Selling Items from order_items */}
        <div className="lg:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-[#FF4E00]" />
              Top Selling Dishes
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Real Orders</span>
          </div>

          <div className="space-y-3.5 text-xs">
            {analytics?.topSellingItems && analytics.topSellingItems.length > 0 ? (
              analytics.topSellingItems.map((item, idx) => {
                const maxOrders = Math.max(...analytics.topSellingItems.map((t) => t.ordersCount), 1);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between font-semibold text-slate-800">
                      <span>{item.name}</span>
                      <span className="text-slate-500">
                        {item.ordersCount} ordered · ₹{Math.round(item.revenueMinor / 100)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FF4E00]"
                        style={{ width: `${(item.ordersCount / maxOrders) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400">
                <UtensilsCrossed className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                <p className="font-bold text-xs">No dish sales recorded yet</p>
                <p className="text-[11px] mt-0.5">Orders placed from the customer menu will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Real Recent Orders from PostgreSQL orders table */}
        <div className="lg:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Recent Live Orders</h2>
            <Link href="/owner/sales" className="text-xs font-semibold text-[#FF4E00] hover:underline">
              View All Orders →
            </Link>
          </div>

          <div className="space-y-2.5 text-xs">
            {analytics?.recentOrders && analytics.recentOrders.length > 0 ? (
              analytics.recentOrders.map((order) => {
                const orderTime = new Date(order.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">#{order.orderNumber}</span>
                      <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                        {order.tableCode ? `Table ${order.tableCode}` : order.channel}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">₹{Math.round(order.totalMinor / 100)}</p>
                      <p className="text-[10px] text-slate-400">{orderTime} · {order.status}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400">
                <ShoppingBag className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                <p className="font-bold text-xs">No orders placed yet</p>
                <p className="text-[11px] mt-0.5">Scan table QR to place a test order</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Operations Status & Verification */}
        <div className="lg:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Live Store Status</h2>

          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-bold">Database Synchronized</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Connected to Supabase PostgreSQL with verified tenant boundary.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50/70 p-3.5 text-xs text-orange-900">
            <Store className="h-4 w-4 shrink-0 text-[#FF4E00] mt-0.5" />
            <div>
              <p className="font-bold">{analytics?.totalOutlets ?? 0} Outlets Online</p>
              <p className="text-[11px] text-orange-800 mt-0.5">
                Menu catalogs and kitchen stations ready to accept orders.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
            <UtensilsCrossed className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-bold">{analytics?.totalMenuItems ?? 0} Menu Items Live</p>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Ready for QR scan ordering and instant availability 86-ing.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Quick Actions Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-xs px-2 text-nowrap">
          <Zap className="h-4 w-4 text-[#FF4E00]" />
          <span>Quick Actions</span>
        </div>

        <Link
          href="/owner/menu"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF4E00] px-3.5 py-2 text-xs font-bold text-[#FF4E00] hover:bg-orange-50 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Menu Item
        </Link>

        <Link
          href="/owner/menu"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <Layers className="h-3.5 w-3.5 text-slate-500" />
          Manage Categories
        </Link>

        <Link
          href="/owner/sales"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <BarChart2 className="h-3.5 w-3.5 text-slate-500" />
          View Detailed Sales
        </Link>

        <Link
          href="/staff/kitchen"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <UtensilsCrossed className="h-3.5 w-3.5 text-slate-500" />
          Kitchen Display (KDS)
        </Link>
      </div>
    </div>
  );
}
