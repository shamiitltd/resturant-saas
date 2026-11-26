'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Layers,
  Plus,
  Search,
  RefreshCw,
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  RotateCw,
  ExternalLink,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  X,
  ShieldAlert,
  UtensilsCrossed,
  Save,
  Minus,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import type {
  AuthMeResponseDto,
  OwnerTableDto,
  OwnerTablesOverviewDto,
  RestaurantTableStatus,
  RestaurantTableType,
  RotateTableQrResponseDto,
} from '@restaurant-saas/contracts';

const STATUS_BADGE_MAP: Record<
  RestaurantTableStatus,
  { label: string; bg: string; text: string; dot: string; cardBorder: string }
> = {
  AVAILABLE: {
    label: 'Available',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    cardBorder: 'border-emerald-200 hover:border-emerald-400',
  },
  OCCUPIED: {
    label: 'Occupied',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    cardBorder: 'border-rose-200 hover:border-rose-400',
  },
  RESERVED: {
    label: 'Reserved',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    cardBorder: 'border-amber-200 hover:border-amber-400',
  },
  INACTIVE: {
    label: 'Out of Service',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    cardBorder: 'border-slate-200 hover:border-slate-300 opacity-75',
  },
};

const SECTIONS = ['Main Hall', 'Window View', 'Outdoor Patio', 'Private Dining', 'Bar Counter'];

export default function OwnerTablesPage() {
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [overview, setOverview] = useState<OwnerTablesOverviewDto | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RestaurantTableStatus>('ALL');

  // QR Code Data URL for selected table
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [rotatingQr, setRotatingQr] = useState(false);

  // Edit form state for selected table
  const [editCode, setEditCode] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editCapacity, setEditCapacity] = useState(4);
  const [editSection, setEditSection] = useState('Main Hall');
  const [editType, setEditType] = useState<RestaurantTableType>('STANDARD');
  const [editStatus, setEditStatus] = useState<RestaurantTableStatus>('AVAILABLE');
  const [editAllowQr, setEditAllowQr] = useState(true);
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Table Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newCapacity, setNewCapacity] = useState(4);
  const [newSection, setNewSection] = useState('Main Hall');
  const [newType, setNewType] = useState<RestaurantTableType>('STANDARD');
  const [newAllowQr, setNewAllowQr] = useState(true);
  const [newNotes, setNewNotes] = useState('');
  const [creatingTable, setCreatingTable] = useState(false);

  const loadTables = useCallback(async (locId?: string, silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const qs = locId ? `?locationId=${encodeURIComponent(locId)}` : '';
      const data = await fetchWithAuth<OwnerTablesOverviewDto>(`/v1/owner/tables${qs}`);
      setOverview(data);
      setSelectedLocationId(data.locationId);
      setError(null);
      setPermissionDenied(false);
      setSelectedTableId((prev) => {
        if (prev && data.tables.some((t) => t.id === prev)) return prev;
        return data.tables[0]?.id || null;
      });
    } catch (err: any) {
      if (err.status === 403 || err.message?.toLowerCase().includes('only owner')) {
        setPermissionDenied(true);
      } else {
        setError(err.message || 'Failed to load tables');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const me = await fetchWithAuth<AuthMeResponseDto>('/v1/auth/me');
        const membership = me.memberships[0];
        if (membership) {
          setLocations(membership.locations || []);
          const initialLoc =
            me.activeLocationId || membership.locations?.[0]?.id || undefined;
          await loadTables(initialLoc);
        } else {
          await loadTables();
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize tables workspace');
        setLoading(false);
      }
    }
    init();
  }, [loadTables]);

  const selectedTable = useMemo<OwnerTableDto | null>(() => {
    if (!overview || !selectedTableId) return null;
    return overview.tables.find((t) => t.id === selectedTableId) || null;
  }, [overview, selectedTableId]);

  // Sync edit form when selected table changes
  useEffect(() => {
    if (!selectedTable) return;
    setEditCode(selectedTable.tableCode);
    setEditLabel(selectedTable.label);
    setEditCapacity(selectedTable.capacity);
    setEditSection(selectedTable.section || 'Main Hall');
    setEditType(selectedTable.tableType || 'STANDARD');
    setEditStatus(selectedTable.status);
    setEditAllowQr(selectedTable.allowQrOrdering);
    setEditNotes(selectedTable.notes || '');
  }, [selectedTable]);

  // Build QR URL & generate Data URL
  const qrJoinUrl = useMemo(() => {
    if (!selectedTable?.activeQrToken?.rawToken) return '';
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return `${origin}/table/${selectedTable.activeQrToken.rawToken}`;
  }, [selectedTable?.activeQrToken?.rawToken]);

  useEffect(() => {
    let cancelled = false;
    async function gen() {
      if (!qrJoinUrl) {
        setQrDataUrl(null);
        return;
      }
      try {
        const url = await QRCode.toDataURL(qrJoinUrl, {
          width: 480,
          margin: 2,
          color: { dark: '#0F172A', light: '#FFFFFF' },
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    }
    gen();
    return () => {
      cancelled = true;
    };
  }, [qrJoinUrl]);

  const filteredTables = useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    return overview.tables.filter((t) => {
      const effectiveStatus = t.activeSession ? 'OCCUPIED' : t.status;
      if (statusFilter !== 'ALL' && effectiveStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        t.tableCode.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.section.toLowerCase().includes(q)
      );
    });
  }, [overview, searchQuery, statusFilter]);

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newLabel.trim()) return;
    setCreatingTable(true);
    setFeedback(null);
    try {
      const created = await fetchWithAuth<OwnerTableDto>('/v1/owner/tables', {
        method: 'POST',
        body: JSON.stringify({
          locationId: selectedLocationId || undefined,
          tableCode: newCode.trim().toUpperCase(),
          label: newLabel.trim(),
          capacity: newCapacity,
          section: newSection.trim() || 'Main Hall',
          tableType: newType,
          allowQrOrdering: newAllowQr,
          notes: newNotes.trim() || undefined,
        }),
      });
      setAddModalOpen(false);
      setNewCode('');
      setNewLabel('');
      setNewCapacity(4);
      setNewNotes('');
      await loadTables(selectedLocationId, true);
      setSelectedTableId(created.id);
      setFeedback({
        type: 'success',
        message: `Table ${created.tableCode} created with a live QR code.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create table' });
    } finally {
      setCreatingTable(false);
    }
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    setSavingEdit(true);
    setFeedback(null);
    try {
      const updated = await fetchWithAuth<OwnerTableDto>(
        `/v1/owner/tables/${selectedTable.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            tableCode: editCode.trim().toUpperCase(),
            label: editLabel.trim(),
            capacity: editCapacity,
            section: editSection.trim() || 'Main Hall',
            tableType: editType,
            status: editStatus,
            allowQrOrdering: editAllowQr,
            notes: editNotes.trim() || null,
          }),
        }
      );
      await loadTables(selectedLocationId, true);
      setFeedback({
        type: 'success',
        message: `Saved changes for ${updated.tableCode}.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update table' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRotateQr = async () => {
    if (!selectedTable) return;
    const confirmed = window.confirm(
      `Rotate QR code for ${selectedTable.tableCode}? Any previously printed QR code for this table will immediately stop working.`
    );
    if (!confirmed) return;

    setRotatingQr(true);
    setFeedback(null);
    try {
      const res = await fetchWithAuth<RotateTableQrResponseDto>(
        `/v1/owner/tables/${selectedTable.id}/rotate-qr`,
        { method: 'POST' }
      );
      await loadTables(selectedLocationId, true);
      setFeedback({
        type: 'success',
        message: `QR code rotated for ${selectedTable.tableCode} (${res.revokedCount} old token revoked).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to rotate QR code' });
    } finally {
      setRotatingQr(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!qrJoinUrl) return;
    try {
      await navigator.clipboard.writeText(qrJoinUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !selectedTable) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${overview?.tenantSlug || 'table'}-${selectedTable.tableCode}-qr.png`;
    link.click();
  };

  const handlePrintQr = () => {
    if (!qrDataUrl || !selectedTable) return;
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>Table ${selectedTable.tableCode} QR</title></head>
        <body style="font-family: system-ui, sans-serif; text-align: center; padding: 32px;">
          <h2 style="margin: 0 0 4px;">${overview?.tenantName || 'Restaurant'}</h2>
          <p style="margin: 0 0 20px; color: #64748b; font-size: 13px;">${overview?.locationName || ''}</p>
          <div style="display:inline-block; padding: 16px; border: 2px solid #e2e8f0; border-radius: 16px;">
            <img src="${qrDataUrl}" style="width: 240px; height: 240px;" />
          </div>
          <h1 style="margin: 20px 0 4px; font-size: 28px;">${selectedTable.tableCode}</h1>
          <p style="margin: 0 0 12px; color: #475569;">${selectedTable.label} • ${selectedTable.section}</p>
          <p style="font-size: 12px; color: #64748b;">Scan with your phone camera to view menu &amp; order</p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-[#FD5001]" />
        <p className="mt-3 text-sm font-medium text-slate-600">Loading tables &amp; QR codes...</p>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-extrabold text-slate-900">Permission Denied</h2>
        <p className="mt-1 text-sm text-slate-500">
          Only restaurant Owners or Managers can configure tables and rotate QR codes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header (matching 03-owner/40-table-floor-plan-management.png) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Table &amp; QR Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage dining tables, seating capacity, and revocable QR ordering tokens per branch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {locations.length > 0 && (
            <select
              aria-label="Select branch"
              value={selectedLocationId}
              onChange={(e) => loadTables(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs focus:border-[#FD5001] focus:outline-none"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  Outlet: {loc.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => loadTables(selectedLocationId)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#FD5001] px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-[#e54801]"
          >
            <Plus className="h-4 w-4" />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* KPI Strip (matching 03-owner/40-table-floor-plan-management.png) */}
      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            {
              key: 'ALL' as const,
              label: 'Total Tables',
              value: overview.summary.total,
              color: 'text-slate-900',
              bg: 'bg-blue-50 text-blue-600',
              icon: Layers,
            },
            {
              key: 'AVAILABLE' as const,
              label: 'Available',
              value: overview.summary.available,
              color: 'text-emerald-700',
              bg: 'bg-emerald-50 text-emerald-600',
              icon: CheckCircle2,
            },
            {
              key: 'OCCUPIED' as const,
              label: 'Occupied',
              value: overview.summary.occupied,
              color: 'text-rose-700',
              bg: 'bg-rose-50 text-rose-600',
              icon: UtensilsCrossed,
            },
            {
              key: 'RESERVED' as const,
              label: 'Reserved',
              value: overview.summary.reserved,
              color: 'text-amber-700',
              bg: 'bg-amber-50 text-amber-600',
              icon: Clock,
            },
            {
              key: 'INACTIVE' as const,
              label: 'Out of Service',
              value: overview.summary.inactive,
              color: 'text-slate-600',
              bg: 'bg-slate-100 text-slate-500',
              icon: AlertCircle,
            },
          ].map((kpi) => {
            const Icon = kpi.icon;
            const active = statusFilter === kpi.key;
            return (
              <button
                key={kpi.key}
                type="button"
                onClick={() => setStatusFilter(kpi.key)}
                className={`flex items-center gap-3 rounded-2xl border bg-white p-3.5 text-left shadow-xs transition ${
                  active ? 'border-[#FD5001] ring-2 ring-[#FD5001]/15' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className={`text-xl font-black leading-none ${kpi.color}`}>{kpi.value}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{kpi.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Split Workspace: Tables Floor Grid + Configuration & QR Inspector */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        {/* Left: Table Grid & Search */}
        <div className="xl:col-span-7 min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by table code, label, or section..."
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#FD5001] focus:outline-none"
                />
              </div>
              <span className="text-xs font-semibold text-slate-500 shrink-0">
                Showing {filteredTables.length} of {overview?.tables.length || 0} tables
              </span>
            </div>

            {filteredTables.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
                <Layers className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-bold text-slate-700">No tables found</p>
                <p className="mt-1 text-xs text-slate-500">
                  Add a dining table to generate its scannable QR ordering code.
                </p>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#FD5001] px-4 py-2 text-xs font-bold text-white hover:bg-[#e54801]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add First Table</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTables.map((table) => {
                  const effectiveStatus: RestaurantTableStatus = table.activeSession
                    ? 'OCCUPIED'
                    : table.status;
                  const badge = STATUS_BADGE_MAP[effectiveStatus];
                  const isSelected = table.id === selectedTableId;
                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedTableId(table.id)}
                      className={`rounded-2xl border p-3.5 text-left transition min-w-0 ${badge.cardBorder} ${
                        isSelected
                          ? 'ring-2 ring-[#FD5001] bg-orange-50/30'
                          : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-base font-black text-slate-900 truncate block">
                            {table.tableCode}
                          </span>
                          <p className="text-xs font-semibold text-slate-600 truncate">
                            {table.label}
                          </p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.bg} ${badge.text}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1 font-medium shrink-0">
                          <Users className="h-3.5 w-3.5" />
                          {table.capacity} seats
                        </span>
                        <span className="font-medium truncate max-w-[110px] text-right">
                          {table.section}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                          <QrCode className="h-3 w-3 text-[#FD5001]" />
                          {table.activeQrToken ? 'QR Active' : 'No QR'}
                        </span>
                        {table.activeSession && (
                          <span className="font-bold text-rose-600 truncate">
                            {table.activeSession.ordersCount} active order(s)
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Table Configuration & QR Code Inspector (matching 03-owner/41-table-configuration-qr-code.png) */}
        <div className="xl:col-span-5 min-w-0 space-y-4">
          {!selectedTable ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
              <QrCode className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-700">Select a Table</p>
              <p className="mt-1 text-xs text-slate-500">
                Choose a table from the floor grid to view its QR code, rotate its token, or edit configuration.
              </p>
            </div>
          ) : (
            <>
              {/* QR Code Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <QrCode className="h-4 w-4 text-[#FD5001] shrink-0" />
                    <h2 className="text-sm font-extrabold text-slate-900 truncate">
                      Table QR Code — {selectedTable.tableCode}
                    </h2>
                  </div>
                  {selectedTable.activeQrToken && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`QR Code for ${selectedTable.tableCode}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-xs min-w-0 w-full">
                    <div className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-[11px]">
                      <span className="text-slate-500">Table Code</span>
                      <span className="font-bold text-slate-900 truncate">{selectedTable.tableCode}</span>
                      <span className="text-slate-500">Outlet</span>
                      <span className="font-semibold text-slate-800 truncate">
                        {overview?.locationName}
                      </span>
                      <span className="text-slate-500">Token</span>
                      <span className="font-mono text-[11px] text-slate-700 truncate" title={selectedTable.activeQrToken?.rawToken || ''}>
                        {selectedTable.activeQrToken?.rawToken || 'None'}
                      </span>
                    </div>

                    {qrJoinUrl && (
                      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 min-w-0">
                        <span className="flex-1 truncate font-mono text-[11px] text-slate-600" title={qrJoinUrl}>
                          {qrJoinUrl}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyUrl}
                          title="Copy QR URL"
                          className="text-slate-500 hover:text-slate-900 shrink-0"
                        >
                          {copiedUrl ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    disabled={!qrDataUrl}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintQr}
                    disabled={!qrDataUrl}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Printer className="h-3.5 w-3.5 shrink-0" />
                    <span>Print</span>
                  </button>
                  <a
                    href={qrJoinUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span>Test Scan</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleRotateQr}
                    disabled={rotatingQr}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <RotateCw className={`h-3.5 w-3.5 shrink-0 ${rotatingQr ? 'animate-spin' : ''}`} />
                    <span>Rotate</span>
                  </button>
                </div>
              </div>

              {/* Edit Table Details Form */}
              <form
                onSubmit={handleSaveTable}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
              >
                <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2.5">
                  Edit Table — {selectedTable.tableCode}
                </h3>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Table Code *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={32}
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={64}
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Section / Area
                    </label>
                    <select
                      value={SECTIONS.includes(editSection) ? editSection : 'Main Hall'}
                      onChange={(e) => setEditSection(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                    >
                      {SECTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Seating Capacity *
                    </label>
                    <div className="flex items-center rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setEditCapacity((c) => Math.max(1, c - 1))}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-50"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="flex-1 text-center text-xs font-extrabold text-slate-900">
                        {editCapacity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditCapacity((c) => Math.min(40, c + 1))}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Table Type
                    </label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as RestaurantTableType)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                    >
                      <option value="STANDARD">Standard</option>
                      <option value="BOOTH">Booth</option>
                      <option value="OUTDOOR">Outdoor</option>
                      <option value="PRIVATE">Private / Event</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as RestaurantTableStatus)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="OCCUPIED">Occupied</option>
                      <option value="RESERVED">Reserved</option>
                      <option value="INACTIVE">Out of Service</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer">
                  <div>
                    <span className="block text-xs font-bold text-slate-900">
                      Allow QR Ordering
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Guests can scan and place dine-in orders from this table.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editAllowQr}
                    onChange={(e) => setEditAllowQr(e.target.checked)}
                    className="h-4 w-4 accent-[#FD5001]"
                  />
                </label>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g. Near the window, good for groups."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#FD5001] px-4 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-[#e54801] disabled:opacity-60"
                  >
                    {savingEdit ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Add Table Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Add New Table</h2>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Table Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. T-05"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={64}
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Table 5 (Patio)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Seats *</label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    required
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
                  <select
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                  >
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as RestaurantTableType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="BOOTH">Booth</option>
                    <option value="OUTDOOR">Outdoor</option>
                    <option value="PRIVATE">Private</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAllowQr}
                  onChange={(e) => setNewAllowQr(e.target.checked)}
                  className="h-4 w-4 accent-[#FD5001]"
                />
                <span>Generate active QR code for immediate guest ordering</span>
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Optional seating note"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#FD5001] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTable}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#FD5001] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#e54801] disabled:opacity-60"
                >
                  {creatingTable && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Create Table &amp; QR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
