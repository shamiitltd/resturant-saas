'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import type { AuthMeResponseDto } from '@restaurant-saas/contracts';

export default function OwnerDashboardPage() {
  const [ownerName, setOwnerName] = useState('Raghav');
  const [salesMetricMode, setSalesMetricMode] = useState<'sales' | 'orders'>('sales');

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const profile = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');
          const firstName = (profile.user.fullName || session.user.user_metadata?.full_name || 'Raghav').split(' ')[0];
          setOwnerName(firstName);
        }
      } catch (err) {
        console.warn('Dashboard profile load fallback:', err);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Welcome Banner matching 01-owner-dashboard-overview.png */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-xs">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Good afternoon, {ownerName} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Here&apos;s how your restaurants are performing across all outlets.
            </p>
          </div>
        </div>

        {/* Counter Pills on Right */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-orange-50/70 border border-orange-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-[#FF4E00]">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">3</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">Outlets</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">42</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">Total Staff</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">142</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">Menu Items</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <GitFork className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">2</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">Integrations</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards (5 Cards Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Sales */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Sales</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">₹5,62,430</p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1">
              <span>▲ +12.4%</span>
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
            <p className="text-xl font-extrabold text-slate-900 mt-1">1,286</p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1">
              <span>▲ +10.9%</span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <ShoppingBag className="h-5 w-5" />
          </div>
        </div>

        {/* Total Guests */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Guests</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">3,742</p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1">
              <span>▲ +11.8%</span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Avg Order Value */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Avg. Order Value</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1">₹436</p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1">
              <span>▲ +1.4%</span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* Avg Rating */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Avg. Rating</span>
            <p className="text-xl font-extrabold text-slate-900 mt-1 flex items-center gap-1">
              4.6 <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">(1,284 reviews)</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-500 border border-amber-100">
            <Star className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Middle Row: Sales Trend + Orders by Channel + Outlet Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-5 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#FF4E00]" />
              <h2 className="text-sm font-bold text-slate-900">Sales Trend</h2>
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
                Sales
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
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF4E00" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#FF4E00" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="400" y2="30" stroke="#F1F5F9" strokeDasharray="3 3" />
              <line x1="0" y1="70" x2="400" y2="70" stroke="#F1F5F9" strokeDasharray="3 3" />
              <line x1="0" y1="110" x2="400" y2="110" stroke="#F1F5F9" strokeDasharray="3 3" />

              {/* Area */}
              <polygon
                points="0,140 0,110 60,120 120,130 180,120 240,60 300,90 360,100 400,65 400,140"
                fill="url(#salesGrad)"
              />
              {/* Curve Line */}
              <polyline
                points="0,110 60,120 120,130 180,120 240,60 300,90 360,100 400,65"
                fill="none"
                stroke="#FF4E00"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* High Point Dot */}
              <circle cx="240" cy="60" r="5" fill="#FF4E00" stroke="#FFFFFF" strokeWidth="2" />
            </svg>

            {/* Peak Tooltip Pill */}
            <div className="absolute top-1 left-[54%] -translate-x-1/2 rounded-lg border border-orange-200 bg-white px-2.5 py-1 text-center shadow-xs">
              <p className="text-[10px] text-slate-400">12 Nov 2026</p>
              <p className="text-xs font-extrabold text-slate-900">₹82,430</p>
            </div>
          </div>

          {/* Days axis */}
          <div className="flex justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            <span>8 Nov</span>
            <span>9 Nov</span>
            <span>10 Nov</span>
            <span>11 Nov</span>
            <span>12 Nov</span>
            <span>13 Nov</span>
            <span>14 Nov</span>
          </div>
        </div>

        {/* Orders by Channel */}
        <div className="lg:col-span-3 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-[#FF4E00]" />
            <h2 className="text-sm font-bold text-slate-900">Orders by Channel</h2>
          </div>

          <div className="flex items-center justify-center my-2">
            {/* Donut representation */}
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#FF4E00" strokeWidth="5" strokeDasharray="42 100" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#0038FF" strokeWidth="5" strokeDasharray="24 100" strokeDashoffset="-42" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#10B981" strokeWidth="5" strokeDasharray="11 100" strokeDashoffset="-66" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#EF4444" strokeWidth="5" strokeDasharray="14 100" strokeDashoffset="-77" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#8B5CF6" strokeWidth="5" strokeDasharray="9 100" strokeDashoffset="-91" />
              </svg>
              <div className="absolute text-center">
                <p className="text-sm font-extrabold text-slate-900">1,286</p>
                <p className="text-[10px] text-slate-400">Orders</p>
              </div>
            </div>
          </div>

          {/* Breakdown legend */}
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF4E00]" />
                Dine-in
              </span>
              <span className="font-semibold text-slate-800">42.4% (546)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0038FF]" />
                Takeaway
              </span>
              <span className="font-semibold text-slate-800">23.8% (306)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                Online (QR)
              </span>
              <span className="font-semibold text-slate-800">11.1% (143)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
                Zomato
              </span>
              <span className="font-semibold text-slate-800">13.6% (175)</span>
            </div>
          </div>
        </div>

        {/* Outlet Performance */}
        <div className="lg:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-4 w-4 text-[#FF4E00]" />
            <h2 className="text-sm font-bold text-slate-900">Outlet Performance</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                  <th className="pb-2">Outlet</th>
                  <th className="pb-2 text-right">Sales (₹)</th>
                  <th className="pb-2 text-right">Orders</th>
                  <th className="pb-2 text-right">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 font-bold text-slate-800 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Rohini (Main)
                  </td>
                  <td className="py-2.5 text-right font-semibold">₹2,86,540</td>
                  <td className="py-2.5 text-right text-slate-600">642</td>
                  <td className="py-2.5 text-right text-emerald-600 font-bold">▲ +13.2%</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-slate-800 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Pitampura
                  </td>
                  <td className="py-2.5 text-right font-semibold">₹1,82,340</td>
                  <td className="py-2.5 text-right text-slate-600">398</td>
                  <td className="py-2.5 text-right text-emerald-600 font-bold">▲ +10.7%</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-slate-800 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Netaji Subhash
                  </td>
                  <td className="py-2.5 text-right font-semibold">₹93,550</td>
                  <td className="py-2.5 text-right text-slate-600">246</td>
                  <td className="py-2.5 text-right text-emerald-600 font-bold">▲ +8.9%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-100 text-right">
            <Link
              href="/select-outlet"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF4E00] hover:underline"
            >
              Switch Outlets <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Bottom Operations Row: Top Items + Recent Orders + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Selling Items */}
        <div className="lg:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-[#FF4E00]" />
              Top Selling Items
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">By Quantity</span>
          </div>

          <div className="space-y-3.5 text-xs">
            {[
              { name: 'Paneer Butter Masala', qty: 286, max: 300 },
              { name: 'Veg Biryani', qty: 241, max: 300 },
              { name: 'Butter Chicken', qty: 198, max: 300 },
              { name: 'Garlic Naan', qty: 176, max: 300 },
              { name: 'Dal Makhani', qty: 149, max: 300 },
            ].map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>{item.name}</span>
                  <span className="text-slate-500">{item.qty}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#FF4E00]"
                    style={{ width: `${(item.qty / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Recent Orders</h2>
            <Link href="/owner/sales" className="text-xs font-semibold text-[#FF4E00] hover:underline">
              View All Orders →
            </Link>
          </div>

          <div className="space-y-2.5 text-xs">
            {[
              { id: '#TB8643', channel: 'Dine-in', loc: 'Rohini', amount: '₹1,476', time: '2 min ago' },
              { id: '#TB8642', channel: 'Takeaway', loc: 'Pitampura', amount: '₹598', time: '6 min ago' },
              { id: '#ZM9271', channel: 'Zomato', loc: 'Rohini', amount: '₹836', time: '8 min ago' },
              { id: '#SW4419', channel: 'Swiggy', loc: 'NSP', amount: '₹1,028', time: '12 min ago' },
              { id: '#TB8641', channel: 'Dine-in', loc: 'Rohini', amount: '₹2,064', time: '15 min ago' },
            ].map((order, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-xs">{order.id}</span>
                  <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                    {order.channel}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{order.amount}</p>
                  <p className="text-[10px] text-slate-400">{order.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Insights */}
        <div className="lg:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Alerts & Insights</h2>

          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-bold">3 items are low in stock</p>
              <p className="text-[11px] text-red-700 mt-0.5">Paneer, Basmati Rice, Cooking Cream</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
            <Calendar className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">6 upcoming reservations today</p>
              <p className="text-[11px] text-amber-700 mt-0.5">Next: 7:00 PM (6 guests)</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-bold">Sales up by 12.4%</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">Performance outpacing last week</p>
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
          href="/owner/staff"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <Users className="h-3.5 w-3.5 text-slate-500" />
          Add Staff
        </Link>

        <Link
          href="/owner/outlets"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <Store className="h-3.5 w-3.5 text-slate-500" />
          Manage Outlets
        </Link>

        <Link
          href="/owner/sales"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <BarChart2 className="h-3.5 w-3.5 text-slate-500" />
          View Reports
        </Link>

        <Link
          href="/owner/integrations"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <Settings className="h-3.5 w-3.5 text-slate-500" />
          Manage Integrations
        </Link>
      </div>
    </div>
  );
}
