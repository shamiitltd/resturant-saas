import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';

export interface OwnerAnalyticsSummaryDto {
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

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  async getOwnerAnalytics(tenantId: string): Promise<OwnerAnalyticsSummaryDto> {
    // 1. Summary Metrics
    const summaryRes = await this.db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN status != 'CANCELLED' AND status != 'REJECTED' THEN total_minor ELSE 0 END), 0)::bigint AS total_sales_minor,
         COUNT(*)::int AS total_orders,
         COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS completed_orders,
         COUNT(CASE WHEN status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED') THEN 1 END)::int AS active_orders
       FROM orders
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const row = summaryRes.rows[0] || {};
    const totalSalesMinor = Number(row.total_sales_minor || 0);
    const totalOrders = Number(row.total_orders || 0);
    const completedOrders = Number(row.completed_orders || 0);
    const activeOrders = Number(row.active_orders || 0);
    const avgOrderValueMinor = totalOrders > 0 ? Math.round(totalSalesMinor / totalOrders) : 0;

    // 2. Counts for Outlets, Staff, Menu Items, Categories
    const countsRes = await this.db.query(
      `SELECT 
         (SELECT COUNT(*)::int FROM locations WHERE tenant_id = $1 AND status = 'ACTIVE') AS outlets_count,
         (SELECT COUNT(*)::int FROM tenant_memberships WHERE tenant_id = $1) AS staff_count,
         (SELECT COUNT(*)::int FROM menu_items WHERE tenant_id = $1) AS items_count,
         (SELECT COUNT(*)::int FROM menu_categories WHERE tenant_id = $1) AS categories_count`,
      [tenantId]
    );
    const counts = countsRes.rows[0] || {};
    const totalOutlets = Number(counts.outlets_count || 0);
    const totalStaff = Number(counts.staff_count || 0);
    const totalMenuItems = Number(counts.items_count || 0);
    const totalCategories = Number(counts.categories_count || 0);

    // Approximate guests: completedOrders * 2.5 or 0
    const totalGuests = completedOrders > 0 ? Math.round(completedOrders * 2.5) : 0;

    // 3. 7-Day Sales Trend (Past 7 calendar days up to today)
    const trendRes = await this.db.query(
      `WITH days AS (
         SELECT generate_series(
           CURRENT_DATE - INTERVAL '6 days',
           CURRENT_DATE,
           '1 day'::interval
         )::date AS day
       )
       SELECT 
         d.day,
         TO_CHAR(d.day, 'DD Mon') AS label,
         COALESCE(SUM(o.total_minor), 0)::bigint AS sales_minor,
         COUNT(o.id)::int AS orders_count
       FROM days d
       LEFT JOIN orders o ON DATE(o.created_at) = d.day 
         AND o.tenant_id = $1 
         AND o.status != 'CANCELLED' 
         AND o.status != 'REJECTED'
       GROUP BY d.day
       ORDER BY d.day ASC`,
      [tenantId]
    );

    const salesTrend = trendRes.rows.map((r: any) => ({
      date: r.day.toISOString ? r.day.toISOString().split('T')[0] : String(r.day),
      label: r.label,
      salesMinor: Number(r.sales_minor || 0),
      ordersCount: Number(r.orders_count || 0),
    }));

    // 4. Sales by Channel
    const channelRes = await this.db.query(
      `SELECT 
         COALESCE(source_channel, 'QR_DINE_IN') AS channel,
         COUNT(*)::int AS orders_count,
         COALESCE(SUM(total_minor), 0)::bigint AS sales_minor
       FROM orders
       WHERE tenant_id = $1 AND status != 'CANCELLED' AND status != 'REJECTED'
       GROUP BY source_channel
       ORDER BY sales_minor DESC`,
      [tenantId]
    );

    const channelMap: Record<string, { name: string; color: string }> = {
      QR_DINE_IN: { name: 'Online (QR)', color: '#FF4E00' },
      DINE_IN: { name: 'Dine-in (POS)', color: '#3B82F6' },
      TAKEAWAY: { name: 'Takeaway', color: '#10B981' },
      ONLINE_QR: { name: 'Online QR', color: '#F59E0B' },
      ZOMATO: { name: 'Zomato', color: '#EF4444' },
      SWIGGY: { name: 'Swiggy', color: '#8B5CF6' },
    };

    const channelBreakdown = channelRes.rows.map((r: any) => {
      const channelKey = r.channel || 'QR_DINE_IN';
      const meta = channelMap[channelKey] || { name: channelKey.replace('_', ' '), color: '#64748B' };
      const ordersCount = Number(r.orders_count || 0);
      const salesMinor = Number(r.sales_minor || 0);
      const percentage = totalOrders > 0 ? Math.round((ordersCount / totalOrders) * 100) : 0;

      return {
        channel: channelKey,
        name: meta.name,
        ordersCount,
        salesMinor,
        percentage,
        color: meta.color,
      };
    });

    // 5. Outlets Performance
    const outletRes = await this.db.query(
      `SELECT 
         l.id,
         l.name,
         l.code,
         l.status,
         COALESCE(SUM(o.total_minor), 0)::bigint AS sales_minor,
         COUNT(o.id)::int AS orders_count
       FROM locations l
       LEFT JOIN orders o ON o.location_id = l.id 
         AND o.status != 'CANCELLED' 
         AND o.status != 'REJECTED'
       WHERE l.tenant_id = $1
       GROUP BY l.id, l.name, l.code, l.status
       ORDER BY sales_minor DESC, l.name ASC`,
      [tenantId]
    );

    const outletPerformance = outletRes.rows.map((r: any) => {
      const salesMinor = Number(r.sales_minor || 0);
      const ordersCount = Number(r.orders_count || 0);
      const avgOrderValueMinor = ordersCount > 0 ? Math.round(salesMinor / ordersCount) : 0;
      return {
        id: r.id,
        name: r.name,
        code: r.code,
        salesMinor,
        ordersCount,
        avgOrderValueMinor,
        status: r.status,
      };
    });

    // 6. Top Selling Items from order_items
    const topItemsRes = await this.db.query(
      `SELECT 
         oi.item_name_snapshot AS name,
         COALESCE(c.name, 'General') AS category,
         COUNT(oi.id)::int AS orders_count,
         COALESCE(SUM(oi.subtotal_minor), 0)::bigint AS revenue_minor
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.id = oi.item_id
       LEFT JOIN menu_categories c ON c.id = mi.category_id
       WHERE o.tenant_id = $1 AND o.status != 'CANCELLED' AND o.status != 'REJECTED'
       GROUP BY oi.item_name_snapshot, c.name
       ORDER BY revenue_minor DESC, orders_count DESC
       LIMIT 10`,
      [tenantId]
    );

    const topSellingItems = topItemsRes.rows.map((r: any) => ({
      name: r.name,
      category: r.category,
      ordersCount: Number(r.orders_count || 0),
      revenueMinor: Number(r.revenue_minor || 0),
    }));

    // 7. Recent Orders
    const recentRes = await this.db.query(
      `SELECT 
         o.id,
         o.order_number,
         rt.table_code,
         o.status,
         o.total_minor,
         o.source_channel AS channel,
         o.created_at
       FROM orders o
       LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
       WHERE o.tenant_id = $1
       ORDER BY o.created_at DESC
       LIMIT 10`,
      [tenantId]
    );

    const recentOrders = recentRes.rows.map((r: any) => ({
      id: r.id,
      orderNumber: r.order_number,
      tableCode: r.table_code || null,
      status: r.status,
      totalMinor: Number(r.total_minor || 0),
      channel: r.channel || 'QR_DINE_IN',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));

    return {
      totalSalesMinor,
      totalOrders,
      completedOrders,
      activeOrders,
      totalGuests,
      avgOrderValueMinor,
      totalOutlets,
      totalStaff,
      totalMenuItems,
      totalCategories,
      salesTrend,
      channelBreakdown,
      outletPerformance,
      topSellingItems,
      recentOrders,
    };
  }
}
