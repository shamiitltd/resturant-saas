'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart2,
  TrendingUp,
  Download,
  Calendar,
  ShoppingBag,
  Users,
  Layers,
  Star,
  Store,
  Clock,
  Lightbulb,
  CheckCircle2,
  ChevronDown,
  Trophy,
  Utensils,
  Soup,
  Flame,
  Wheat,
  ChefHat,
  Percent,
  AlertTriangle,
  Gift,
  Mail,
  FileSpreadsheet,
  FileText,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Building2,
  Compass,
  Smile,
  Timer,
  PieChart,
  HelpCircle,
  XCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';

type ActiveTab =
  | 'overview'
  | 'outlets'
  | 'channels'
  | 'menu'
  | 'customers'
  | 'reservations'
  | 'export';

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

export default function SalesAndAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [trendMetric, setTrendMetric] = useState<'sales' | 'orders'>('sales');
  const [itemsSortMode, setItemsSortMode] = useState<'revenue' | 'orders'>('revenue');

  // Real Database Analytics
  const [analytics, setAnalytics] = useState<OwnerAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth<OwnerAnalyticsDto>('/v1/owner/analytics/sales');
      if (data) {
        setAnalytics(data);
      }
    } catch (err) {
      console.warn('Real sales analytics fetch note:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real Metric Calculations
  const totalSalesINR = Math.round((analytics?.totalSalesMinor || 0) / 100);
  const totalSalesFormatted = totalSalesINR.toLocaleString('en-IN');
  const totalOrdersCount = analytics?.totalOrders || 0;
  const totalGuestsCount = (analytics?.totalGuests || 0).toLocaleString('en-IN');
  const avgOrderValue = Math.round((analytics?.avgOrderValueMinor || 0) / 100);

  // Top Dishes dynamically sorted
  const sortedTopItems = useMemo(() => {
    const list = [...(analytics?.topSellingItems || [])];
    return list.sort((a, b) =>
      itemsSortMode === 'revenue' ? b.revenueMinor - a.revenueMinor : b.ordersCount - a.ordersCount
    );
  }, [analytics, itemsSortMode]);

  // Dynamic SVG curve coordinates for Sales Trend
  const trendPoints = useMemo(() => {
    const data = analytics?.salesTrend || [];
    if (data.length === 0) {
      return {
        polyline: '30,130 390,130',
        polygon: '30,130 390,130 390,150 30,150',
        peakLabel: '₹0',
        peakCoord: { x: 210, y: 130 },
        coords: [],
      };
    }

    const values = data.map((d) => (trendMetric === 'sales' ? Math.round(d.salesMinor / 100) : d.ordersCount));
    const maxVal = Math.max(...values, trendMetric === 'sales' ? 1000 : 5);

    const stepX = 360 / Math.max(data.length - 1, 1);
    const coords = values.map((val, idx) => {
      const x = Math.round(30 + idx * stepX);
      const y = Math.round(130 - (val / maxVal) * 85);
      return { x, y, val };
    });

    const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const polygon = `30,150 ${polyline} 390,150`;

    let peakIndex = 0;
    let peakValue = values[0] || 0;
    values.forEach((v, i) => {
      if (v > peakValue) {
        peakValue = v;
        peakIndex = i;
      }
    });

    const peakLabel = trendMetric === 'sales' ? `₹${peakValue.toLocaleString('en-IN')}` : `${peakValue} Orders`;

    return {
      polyline,
      polygon,
      peakLabel,
      peakCoord: coords[peakIndex] || { x: 210, y: 70 },
      coords,
    };
  }, [analytics, trendMetric]);

  // Export CSV
  const handleExport = () => {
    const ordersData = analytics?.recentOrders || [];
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Metric,Value\n';
    csvContent += `Total Sales,₹${totalSalesFormatted}\n`;
    csvContent += `Total Orders,${totalOrdersCount}\n`;
    csvContent += `Completed Orders,${analytics?.completedOrders || 0}\n`;
    csvContent += `Total Guests,${totalGuestsCount}\n`;
    csvContent += `Avg Order Value,₹${avgOrderValue}\n\n`;

    csvContent += 'Order ID,Status,Channel,Table,Amount (INR),Date\n';
    ordersData.forEach((o) => {
      csvContent += `${o.orderNumber},${o.status},${o.channel},${o.tableCode || 'N/A'},${Math.round(o.totalMinor / 100)},${o.createdAt}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `real_sales_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Section */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#FF4E00] border border-orange-100 shadow-xs">
            <BarChart2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Sales &amp; Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Live database metrics, branch sales breakdown and verified customer transactions.
            </p>
          </div>
        </div>

        {/* Action Buttons on Right */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadData}
            title="Refresh live data"
            suppressHydrationWarning
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            suppressHydrationWarning
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export Report</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            suppressHydrationWarning
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <Calendar className="h-4 w-4 text-slate-500" />
            <span>Scheduled Reports</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold border-b border-slate-200/80">
        {[
          { id: 'overview', label: 'Sales Overview' },
          { id: 'outlets', label: 'Outlet Performance' },
          { id: 'channels', label: 'Channel Analytics' },
          { id: 'menu', label: 'Menu Performance' },
          { id: 'customers', label: 'Customer Insights' },
          { id: 'reservations', label: 'Reservations' },
          { id: 'export', label: 'Export & Schedule' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 transition ${
              activeTab === tab.id
                ? 'bg-[#FF4E00] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SALES OVERVIEW (100% Real Live Database Data)                      */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top 5 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100 font-extrabold text-lg">
                ₹
              </div>
              <div className="min-w-0">
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight block truncate">
                  ₹{totalSalesFormatted}
                </span>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Total Sales</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight block">
                  {totalOrdersCount}
                </span>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Total Orders</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight block">
                  {totalGuestsCount}
                </span>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Total Guests</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100">
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight block">
                  ₹{avgOrderValue.toLocaleString('en-IN')}
                </span>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Avg. Order Value</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight block">
                  {analytics?.completedOrders ?? 0}
                </span>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Completed Orders</p>
              </div>
            </div>
          </div>

          {/* Row 2: Sales Trend + Sales by Channel + Sales by Outlet */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Sales Trend Chart */}
            <div className="lg:col-span-12 xl:col-span-5 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#FF4E00]" />
                  <h2 className="text-sm font-bold text-slate-900">7-Day Real Sales Trend</h2>
                </div>
                <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setTrendMetric('sales')}
                    className={`px-3 py-1 rounded-md transition ${
                      trendMetric === 'sales'
                        ? 'bg-[#FF4E00] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sales
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMetric('orders')}
                    className={`px-3 py-1 rounded-md transition ${
                      trendMetric === 'orders'
                        ? 'bg-[#FF4E00] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Orders
                  </button>
                </div>
              </div>

              {/* Dynamic SVG Curve */}
              <div className="relative h-52 w-full pt-2">
                <svg viewBox="0 0 400 160" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="salesGradReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF4E00" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#FF4E00" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <line x1="30" y1="30" x2="390" y2="30" stroke="#F1F5F9" strokeDasharray="3 3" />
                  <line x1="30" y1="70" x2="390" y2="70" stroke="#F1F5F9" strokeDasharray="3 3" />
                  <line x1="30" y1="110" x2="390" y2="110" stroke="#F1F5F9" strokeDasharray="3 3" />

                  <polygon points={trendPoints.polygon} fill="url(#salesGradReal)" />
                  <polyline
                    points={trendPoints.polyline}
                    fill="none"
                    stroke="#FF4E00"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {trendPoints.coords?.map((c, i) => (
                    <circle
                      key={i}
                      cx={c.x}
                      cy={c.y}
                      r="4"
                      fill="#FF4E00"
                      stroke="#FFFFFF"
                      strokeWidth="2"
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

            {/* Sales by Channel Donut */}
            <div className="lg:col-span-6 xl:col-span-3 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-[#FF4E00]" />
                <h2 className="text-sm font-bold text-slate-900">Sales by Channel</h2>
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
                    <p className="text-xs font-black text-slate-900">₹{totalSalesFormatted}</p>
                    <p className="text-[9px] text-slate-400">Total Sales</p>
                  </div>
                </div>
              </div>

              {/* Channels list */}
              <div className="space-y-1.5 text-xs">
                {analytics?.channelBreakdown && analytics.channelBreakdown.length > 0 ? (
                  analytics.channelBreakdown.map((ch) => (
                    <div key={ch.channel} className="flex items-center justify-between text-slate-600">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                        <span className="truncate">{ch.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{ch.percentage}%</span>
                        <span className="text-[11px] text-slate-400">
                          ₹{Math.round(ch.salesMinor / 100).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs text-slate-400 italic py-2">
                    No channel sales recorded yet
                  </p>
                )}
              </div>
            </div>

            {/* Sales by Outlet Table */}
            <div className="lg:col-span-6 xl:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-[#FF4E00]" />
                  <h2 className="text-sm font-bold text-slate-900">Sales by Outlet</h2>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Active Outlets
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-2">Outlet</th>
                      <th className="pb-2 text-right">Sales (₹)</th>
                      <th className="pb-2 text-right">Orders</th>
                      <th className="pb-2 text-right">AOV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics?.outletPerformance && analytics.outletPerformance.length > 0 ? (
                      analytics.outletPerformance.map((outlet) => (
                        <tr key={outlet.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                outlet.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                            />
                            <span className="truncate max-w-[100px]">{outlet.name}</span>
                          </td>
                          <td className="py-2.5 text-right font-extrabold text-slate-900">
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
                          No active outlets found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">
                  {analytics?.totalOutlets ?? 0} active branches
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('outlets')}
                  className="font-bold text-[#FF4E00] hover:underline text-[11px]"
                >
                  View Details →
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Top Selling Dishes + Recent Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Selling Items */}
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[#FF4E00]" />
                  <h2 className="text-sm font-bold text-slate-900">Top Dishes (Real Database Sales)</h2>
                </div>
                <select
                  aria-label="Sort top selling items"
                  value={itemsSortMode}
                  onChange={(e) => setItemsSortMode(e.target.value as any)}
                  className="bg-slate-100 border-none rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="revenue">By Revenue</option>
                  <option value="orders">By Orders</option>
                </select>
              </div>

              <div className="space-y-3">
                {sortedTopItems.length > 0 ? (
                  sortedTopItems.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-[#FF4E00] border border-orange-200">
                          <Utensils className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-[10px] text-slate-400">{item.category}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-extrabold text-slate-900">
                          ₹{Math.round(item.revenueMinor / 100).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-slate-400">{item.ordersCount} orders</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-400">
                    <Utensils className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                    <p className="font-bold text-xs">No dish sales recorded yet</p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('menu')}
                  className="text-xs font-bold text-[#FF4E00] hover:underline"
                >
                  View Full Menu Performance →
                </button>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-[#FF4E00]" />
                  <h2 className="text-sm font-bold text-slate-900">Recent Customer Orders</h2>
                </div>
                <span className="text-xs font-semibold text-slate-400">Live Status</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {analytics?.recentOrders && analytics.recentOrders.length > 0 ? (
                  analytics.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">#{order.orderNumber}</span>
                        <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                          {order.tableCode ? `Table ${order.tableCode}` : order.channel}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">₹{Math.round(order.totalMinor / 100)}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{order.status}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-400">
                    <ShoppingBag className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                    <p className="font-bold text-xs">No orders recorded yet</p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 mt-4 text-center">
                <Link
                  href="/staff/kitchen"
                  className="text-xs font-bold text-[#FF4E00] hover:underline"
                >
                  Open Kitchen Display (KDS) →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: OUTLET PERFORMANCE                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'outlets' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
            <h2 className="text-base font-extrabold text-slate-900 mb-3">
              Branch Performance Comparison ({analytics?.outletPerformance?.length || 0} Outlets)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="pb-3">Branch Name</th>
                    <th className="pb-3">Code</th>
                    <th className="pb-3 text-right">Net Sales (₹)</th>
                    <th className="pb-3 text-right">Orders Volume</th>
                    <th className="pb-3 text-right">AOV (₹)</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics?.outletPerformance && analytics.outletPerformance.length > 0 ? (
                    analytics.outletPerformance.map((outlet) => (
                      <tr key={outlet.id} className="hover:bg-slate-50">
                        <td className="py-3 font-bold text-slate-900">{outlet.name}</td>
                        <td className="py-3 text-slate-500 font-mono text-[11px]">{outlet.code}</td>
                        <td className="py-3 text-right font-extrabold text-slate-900">
                          ₹{Math.round(outlet.salesMinor / 100).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 text-right font-semibold text-slate-700">{outlet.ordersCount}</td>
                        <td className="py-3 text-right font-bold text-orange-600">
                          ₹{Math.round(outlet.avgOrderValueMinor / 100)}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              outlet.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {outlet.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        No outlet performance data available yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CHANNEL ANALYTICS                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
            <h2 className="text-base font-extrabold text-slate-900 mb-3">
              Fulfillment Channel Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="pb-3">Channel</th>
                    <th className="pb-3 text-right">Orders Volume</th>
                    <th className="pb-3 text-right">Share (%)</th>
                    <th className="pb-3 text-right">Total Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics?.channelBreakdown && analytics.channelBreakdown.length > 0 ? (
                    analytics.channelBreakdown.map((ch) => (
                      <tr key={ch.channel} className="hover:bg-slate-50">
                        <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ch.color }} />
                          <span>{ch.name}</span>
                        </td>
                        <td className="py-3 text-right font-semibold text-slate-700">{ch.ordersCount}</td>
                        <td className="py-3 text-right font-bold text-slate-900">{ch.percentage}%</td>
                        <td className="py-3 text-right font-extrabold text-slate-900">
                          ₹{Math.round(ch.salesMinor / 100).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                        No channel order data recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MENU PERFORMANCE                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'menu' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
            <h2 className="text-base font-extrabold text-slate-900 mb-3">
              Item Sales &amp; Revenue Ranking
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="pb-3">Dish</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3 text-right">Orders Sold</th>
                    <th className="pb-3 text-right">Total Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTopItems.length > 0 ? (
                    sortedTopItems.map((item) => (
                      <tr key={item.name} className="hover:bg-slate-50">
                        <td className="py-3 font-bold text-slate-900">{item.name}</td>
                        <td className="py-3 text-slate-500">{item.category}</td>
                        <td className="py-3 text-right font-semibold text-slate-700">{item.ordersCount}</td>
                        <td className="py-3 text-right font-extrabold text-slate-900">
                          ₹{Math.round(item.revenueMinor / 100).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                        No menu items sold yet. Orders from diners will appear here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CUSTOMER INSIGHTS                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Total Diners Served</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{totalGuestsCount}</p>
              <span className="text-[11px] text-slate-400">From table sessions</span>
            </div>
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Average Spend Per Order</span>
              <p className="text-2xl font-black text-slate-900 mt-1">₹{avgOrderValue}</p>
              <span className="text-[11px] text-emerald-600 font-bold">Consolidated AOV</span>
            </div>
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Total Orders Placed</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{totalOrdersCount}</p>
              <span className="text-[11px] text-slate-400">QR &amp; staff orders</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: RESERVATIONS                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'reservations' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-8 text-center border border-slate-200/80 shadow-xs">
            <Calendar className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <h3 className="text-sm font-extrabold text-slate-800">Dine-in Floor &amp; Session Management</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Tables and dine-in guest sessions are active. Customer table QR codes generate instant table sessions.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-200 text-xs font-bold">
              <span>{analytics?.activeOrders ?? 0} Active Orders in Session</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: EXPORT & SCHEDULE                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Export Real Database Reports</h2>
              <p className="text-xs text-slate-500">Download reconciled transactions, receipts and order lines.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-slate-900">CSV Spreadsheet Export</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Summary metrics and individual orders</p>
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  className="px-4 py-2 rounded-xl bg-[#FF4E00] text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
                >
                  Download CSV
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-slate-900">JSON Data Export</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Full audit payload with timestamp</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(analytics, null, 2));
                    const dlAnchor = document.createElement('a');
                    dlAnchor.setAttribute('href', dataStr);
                    dlAnchor.setAttribute('download', `real_analytics_${Date.now()}.json`);
                    dlAnchor.click();
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Download JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
