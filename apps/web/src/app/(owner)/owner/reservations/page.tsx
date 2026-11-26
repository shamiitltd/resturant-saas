'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Armchair,
  Phone,
  Mail,
  UserCheck,
  UserX,
  BellRing,
  Filter,
  Sparkles,
  Layers,
  Info,
  RotateCw,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import type {
  TableReservationDto,
  TableWaitlistDto,
  ReservationsOverviewDto,
  WaitlistOverviewDto,
  OwnerTablesOverviewDto,
  OwnerTableDto,
  CreateReservationRequestDto,
  CreateWaitlistRequestDto,
} from '@restaurant-saas/contracts';

type ActiveTab = 'reservations' | 'calendar' | 'waitlist' | 'rules' | 'history';

export default function OwnerReservationsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('reservations');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter & Date states
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');

  // Data states
  const [reservationsData, setReservationsData] = useState<ReservationsOverviewDto | null>(null);
  const [waitlistData, setWaitlistData] = useState<WaitlistOverviewDto | null>(null);
  const [tablesList, setTablesList] = useState<OwnerTableDto[]>([]);

  // Form states for New Reservation
  const [resGuestName, setResGuestName] = useState('');
  const [resGuestPhone, setResGuestPhone] = useState('');
  const [resGuestEmail, setResGuestEmail] = useState('');
  const [resPartySize, setResPartySize] = useState(2);
  const [resDate, setResDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [resStartTime, setResStartTime] = useState('19:00');
  const [resTableId, setResTableId] = useState('');
  const [resOccasion, setResOccasion] = useState('');
  const [resNotes, setResNotes] = useState('');
  const [isSubmittingRes, setIsSubmittingRes] = useState(false);

  // Form states for Add Waitlist
  const [wlGuestName, setWlGuestName] = useState('');
  const [wlGuestPhone, setWlGuestPhone] = useState('');
  const [wlPartySize, setWlPartySize] = useState(2);
  const [wlSectionPref, setWlSectionPref] = useState('ANY');
  const [wlWaitMinutes, setWlWaitMinutes] = useState(15);
  const [wlNotes, setWlNotes] = useState('');
  const [isSubmittingWl, setIsSubmittingWl] = useState(false);

  // Quick action table modal
  const [actionReservationId, setActionReservationId] = useState<string | null>(null);
  const [actionWaitlistId, setActionWaitlistId] = useState<string | null>(null);
  const [assignTableModalOpen, setAssignTableModalOpen] = useState(false);
  const [selectedTableForAssignment, setSelectedTableForAssignment] = useState('');

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load reservations overview
      const resRes = await fetchWithAuth<ReservationsOverviewDto>(
        `/v1/owner/reservations?date=${selectedDate}`
      );
      if (resRes) {
        setReservationsData(resRes);
      }

      // Load waitlist overview
      const wlRes = await fetchWithAuth<WaitlistOverviewDto>(`/v1/owner/waitlist`);
      if (wlRes) {
        setWaitlistData(wlRes);
      }

      // Load tables for assigning
      const tablesRes = await fetchWithAuth<OwnerTablesOverviewDto>(`/v1/owner/tables`);
      if (tablesRes?.tables) {
        setTablesList(tablesRes.tables);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load reservations and waitlist data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Handle New Reservation submit
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resGuestName.trim() || !resGuestPhone.trim()) {
      setError('Please provide guest name and contact number');
      return;
    }
    try {
      setIsSubmittingRes(true);
      setError(null);
      const payload: CreateReservationRequestDto = {
        guestName: resGuestName.trim(),
        guestPhone: resGuestPhone.trim(),
        guestEmail: resGuestEmail.trim() || undefined,
        partySize: resPartySize,
        reservationDate: resDate,
        startTime: resStartTime,
        tableId: resTableId || null,
        occasion: resOccasion || undefined,
        notes: resNotes || undefined,
        source: 'STAFF',
      };

      const res = await fetchWithAuth<TableReservationDto>('/v1/owner/reservations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res) {
        showNotification(`Reservation ${res.reservationCode} created for ${res.guestName}!`);
        // Reset form
        setResGuestName('');
        setResGuestPhone('');
        setResGuestEmail('');
        setResPartySize(2);
        setResTableId('');
        setResOccasion('');
        setResNotes('');
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create reservation');
    } finally {
      setIsSubmittingRes(false);
    }
  };

  // Handle Add to Waitlist submit
  const handleAddWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wlGuestName.trim() || !wlGuestPhone.trim()) {
      setError('Please provide guest name and phone number for waitlist');
      return;
    }
    try {
      setIsSubmittingWl(true);
      setError(null);
      const payload: CreateWaitlistRequestDto = {
        guestName: wlGuestName.trim(),
        guestPhone: wlGuestPhone.trim(),
        partySize: wlPartySize,
        sectionPreference: wlSectionPref,
        estimatedWaitMinutes: wlWaitMinutes,
        notes: wlNotes || undefined,
      };

      const res = await fetchWithAuth<TableWaitlistDto>('/v1/owner/waitlist', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res) {
        showNotification(`Guest ${res.guestName} added to waitlist (Queue #${res.queueNumber})!`);
        setWlGuestName('');
        setWlGuestPhone('');
        setWlPartySize(2);
        setWlNotes('');
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to add guest to waitlist');
    } finally {
      setIsSubmittingWl(false);
    }
  };

  // Update reservation status (SEATED, CANCELLED, NO_SHOW, COMPLETED)
  const handleUpdateReservationStatus = async (
    id: string,
    status: 'SEATED' | 'CANCELLED' | 'NO_SHOW' | 'CONFIRMED' | 'COMPLETED',
    tableId?: string
  ) => {
    try {
      setError(null);
      const res = await fetchWithAuth<TableReservationDto>(`/v1/owner/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, tableId }),
      });
      if (res) {
        showNotification(`Reservation marked as ${status}`);
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || `Failed to update reservation status`);
    }
  };

  // Update waitlist status (NOTIFIED, SEATED, CANCELLED, NO_SHOW, COMPLETED)
  const handleUpdateWaitlistStatus = async (
    id: string,
    status: 'WAITING' | 'NOTIFIED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED',
    tableId?: string
  ) => {
    try {
      setError(null);
      const res = await fetchWithAuth<TableWaitlistDto>(`/v1/owner/waitlist/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, assignedTableId: tableId }),
      });
      if (res) {
        showNotification(`Waitlist guest status updated to ${status}`);
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || `Failed to update waitlist guest status`);
    }
  };

  // Seat next waiting guest
  const handleSeatNextGuest = () => {
    const nextInQueue = waitlistData?.waitlist.find((w) => w.status === 'WAITING');
    if (!nextInQueue) {
      setError('No waiting guests in queue');
      return;
    }
    setActionWaitlistId(nextInQueue.id);
    setAssignTableModalOpen(true);
  };

  // Filtered reservations
  const filteredReservations = useMemo(() => {
    if (!reservationsData?.reservations) return [];
    return reservationsData.reservations.filter((r) => {
      const matchesSearch =
        r.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.guestPhone.includes(searchQuery) ||
        r.reservationCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.tableCode && r.tableCode.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [reservationsData, searchQuery, statusFilter]);

  // Available tables count
  const availableTables = useMemo(() => {
    return tablesList.filter((t) => t.status === 'AVAILABLE');
  }, [tablesList]);

  // Unique sections
  const sections = useMemo(() => {
    const s = new Set<string>();
    tablesList.forEach((t) => {
      if (t.section) s.add(t.section);
    });
    return Array.from(s);
  }, [tablesList]);

  return (
    <div className="min-w-0 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600">
              <CalendarIcon className="w-7 h-7" />
            </span>
            Table Reservations & Walk-in Waitlist
          </h1>
          <p className="text-sm md:text-base text-slate-500 mt-1">
            Manage table reservations, time slot calendar availability, and live walk-in guest queues.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('reservations')}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Reservation
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('reservations')}
          className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'reservations'
              ? 'border-orange-600 text-orange-600 bg-orange-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          Reservations List
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'calendar'
              ? 'border-orange-600 text-orange-600 bg-orange-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          Booking Calendar & Timeline
        </button>

        <button
          onClick={() => setActiveTab('waitlist')}
          className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'waitlist'
              ? 'border-orange-600 text-orange-600 bg-orange-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Waitlist & Walk-ins
          {waitlistData?.summary.totalWaiting ? (
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 font-bold">
              {waitlistData.summary.totalWaiting}
            </span>
          ) : null}
        </button>
      </div>

      {/* Stat Cards Row */}
      {activeTab === 'waitlist' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">In Waitlist</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">
                {waitlistData?.summary.totalWaiting ?? 0}
              </span>
              <Users className="w-5 h-5 text-violet-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Notified</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-600">
                {waitlistData?.summary.notified ?? 0}
              </span>
              <BellRing className="w-5 h-5 text-blue-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Seated Today</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600">
                {waitlistData?.summary.seatedToday ?? 0}
              </span>
              <UserCheck className="w-5 h-5 text-emerald-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Avg Wait Time</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">
                {waitlistData?.summary.avgWaitMinutes ?? 15} <span className="text-sm font-normal text-slate-500">min</span>
              </span>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Available Tables</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{availableTables.length}</span>
              <Armchair className="w-5 h-5 text-emerald-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Est. Next Wait</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">
                {(waitlistData?.summary.totalWaiting ?? 0) * 10 || 15} <span className="text-sm font-normal text-slate-500">min</span>
              </span>
              <TrendingUp className="w-5 h-5 text-rose-500" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Total Bookings</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">
                {reservationsData?.summary.totalReservations ?? 0}
              </span>
              <CalendarIcon className="w-5 h-5 text-blue-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Confirmed</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600">
                {reservationsData?.summary.confirmed ?? 0}
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Pending</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-600">
                {reservationsData?.summary.pending ?? 0}
              </span>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Seated</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-600">
                {reservationsData?.summary.seated ?? 0}
              </span>
              <UserCheck className="w-5 h-5 text-blue-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Cancelled / No-Show</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-600">
                {(reservationsData?.summary.cancelled ?? 0) + (reservationsData?.summary.noShow ?? 0)}
              </span>
              <XCircle className="w-5 h-5 text-rose-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500">Est. Occupancy</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">
                {tablesList.length > 0
                  ? Math.round(
                      ((tablesList.filter((t) => t.status === 'OCCUPIED' || t.status === 'RESERVED')
                        .length /
                        tablesList.length) *
                        100)
                    )
                  : 0}
                %
              </span>
              <Armchair className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-w-0">
          {/* Left: Reservations Table (8 Cols) */}
          <div className="xl:col-span-8 space-y-4 min-w-0">
            {/* Filter and Search Bar */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="px-3 py-2 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors"
                >
                  Today
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search guest, phone, table..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PENDING">Pending</option>
                  <option value="SEATED">Seated</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
              </div>
            </div>

            {/* Reservations List Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">
                  Reservations for {selectedDate} ({filteredReservations.length})
                </h3>
                <span className="text-xs text-slate-500">Live operational booking list</span>
              </div>

              {filteredReservations.length === 0 ? (
                <div className="p-12 text-center">
                  <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-base font-bold text-slate-700">No reservations found for this date</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Create a new booking using the form on the right or select another date.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Code / Guest</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Party</th>
                        <th className="px-4 py-3">Table</th>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReservations.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900">{r.guestName}</div>
                            <div className="text-xs text-slate-400 font-mono">{r.reservationCode}</div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-mono text-xs">
                            {r.guestPhone}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {r.partySize}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {r.tableCode ? (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
                                {r.tableCode}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 font-medium whitespace-nowrap">
                            {r.startTime.slice(0, 5)} - {r.endTime.slice(0, 5)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                r.status === 'CONFIRMED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : r.status === 'SEATED'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : r.status === 'COMPLETED'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : r.status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            {r.status === 'SEATED' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleUpdateReservationStatus(r.id, 'COMPLETED')}
                                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                                  title="Mark Dining Completed & Free Table"
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={() => handleUpdateReservationStatus(r.id, 'CANCELLED')}
                                  className="px-2 py-1 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-lg text-xs font-semibold"
                                  title="Cancel"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : r.status !== 'COMPLETED' && r.status !== 'CANCELLED' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleUpdateReservationStatus(r.id, 'SEATED', r.tableId || undefined)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                                  title="Mark Seated"
                                >
                                  Seat
                                </button>
                                <button
                                  onClick={() => handleUpdateReservationStatus(r.id, 'CANCELLED')}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-lg text-xs font-semibold"
                                  title="Cancel"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">Done</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right: New Reservation Form (4 Cols) */}
          <div className="xl:col-span-4 min-w-0">
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <span className="p-2 rounded-xl bg-orange-100 text-orange-600">
                  <Plus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">New Reservation</h3>
                  <p className="text-xs text-slate-500">Record direct guest booking</p>
                </div>
              </div>

              <form onSubmit={handleCreateReservation} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guest Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aman Gupta"
                    value={resGuestName}
                    onChange={(e) => setResGuestName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={resGuestPhone}
                    onChange={(e) => setResGuestPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Party Size <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setResPartySize((p) => Math.max(1, p - 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100"
                    >
                      -
                    </button>
                    <span className="text-base font-extrabold text-slate-900 w-8 text-center">
                      {resPartySize}
                    </span>
                    <button
                      type="button"
                      onClick={() => setResPartySize((p) => Math.min(40, p + 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100"
                    >
                      +
                    </button>
                    <span className="text-xs text-slate-500 ml-auto">Guests</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={resDate}
                      onChange={(e) => setResDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Time Slot <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={resStartTime}
                      onChange={(e) => setResStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assign Table (Optional)
                  </label>
                  <select
                    value={resTableId}
                    onChange={(e) => setResTableId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Auto / Assign on Arrival</option>
                    {tablesList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.tableCode} — {t.label} ({t.capacity} seats, {t.section})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Occasion (Optional)
                  </label>
                  <select
                    value={resOccasion}
                    onChange={(e) => setResOccasion(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">None / Regular Dining</option>
                    <option value="Birthday">Birthday</option>
                    <option value="Anniversary">Anniversary</option>
                    <option value="Business Meeting">Business Meeting</option>
                    <option value="Romantic Date">Romantic Date</option>
                    <option value="Family Gathering">Family Gathering</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Special Requests / Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Window seat requested, high chair needed"
                    value={resNotes}
                    onChange={(e) => setResNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingRes}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-sm transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingRes ? 'Creating...' : 'Create Reservation'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Calendar & Timeline View */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Booking Timeline & Availability Grid — {selectedDate}
              </h3>
              <p className="text-xs text-slate-500">Horizontal schedule of tables and bookings</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
              />
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Confirmed
                </span>
                <span className="flex items-center gap-1.5 text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Seated
                </span>
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending
                </span>
              </div>
            </div>
          </div>

          {/* Timeline Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px] space-y-2">
              {/* Header hours */}
              <div className="grid grid-cols-12 text-xs font-bold text-slate-500 border-b pb-2">
                <div className="col-span-2">Table</div>
                <div>12:00</div>
                <div>13:00</div>
                <div>14:00</div>
                <div>15:00</div>
                <div>16:00</div>
                <div>17:00</div>
                <div>18:00</div>
                <div>19:00</div>
                <div>20:00</div>
                <div>21:00</div>
              </div>

              {/* Rows for each table */}
              {tablesList.map((t) => {
                const tableReservations =
                  reservationsData?.reservations.filter((r) => r.tableId === t.id) || [];

                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-12 items-center py-2.5 border-b border-slate-100 hover:bg-slate-50/50"
                  >
                    <div className="col-span-2 font-bold text-slate-800 text-xs flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {t.tableCode}
                      </span>
                      <span className="text-slate-400 font-normal">({t.capacity}p)</span>
                    </div>

                    <div className="col-span-10 relative h-9 bg-slate-50/80 rounded-lg border border-slate-100 overflow-hidden flex items-center px-1">
                      {tableReservations.map((res) => (
                        <div
                          key={res.id}
                          className="h-7 px-2.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 shadow-xs mr-2 truncate"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                          <span className="truncate">
                            {res.guestName} ({res.partySize}p) · {res.startTime.slice(0, 5)}
                          </span>
                        </div>
                      ))}
                      {tableReservations.length === 0 && (
                        <span className="text-[11px] text-slate-400 ml-2">Available all day</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Waitlist View */}
      {activeTab === 'waitlist' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-w-0">
          {/* Left: Queue List & Floor Plan Availability (8 Cols) */}
          <div className="xl:col-span-8 space-y-6 min-w-0">
            {/* Live Queue Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-violet-100 text-violet-700">
                    <Users className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Current Waitlist Queue</h3>
                    <p className="text-xs text-slate-500">Live walk-ins and waiting guests</p>
                  </div>
                </div>

                <button
                  onClick={handleSeatNextGuest}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  Seat Next Guest
                </button>
              </div>

              {!waitlistData?.waitlist || waitlistData.waitlist.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">The waitlist queue is currently clear.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {waitlistData.waitlist.map((w) => (
                    <div
                      key={w.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 font-extrabold flex items-center justify-center text-sm">
                          #{w.queueNumber}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            {w.guestName}
                            <span className="text-xs font-semibold text-slate-500">
                              · {w.partySize} guests
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                            <span>{w.guestPhone}</span>
                            <span>Pref: {w.sectionPreference}</span>
                            {w.assignedTableCode && (
                              <span className="font-bold text-emerald-600">
                                Assigned: {w.assignedTableCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                          ~ {w.estimatedWaitMinutes} min
                        </span>

                        {w.status === 'WAITING' && (
                          <button
                            onClick={() => handleUpdateWaitlistStatus(w.id, 'NOTIFIED')}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold"
                          >
                            Notify
                          </button>
                        )}

                        {w.status !== 'SEATED' && (
                          <button
                            onClick={() => {
                              setActionWaitlistId(w.id);
                              setAssignTableModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                          >
                            Seat
                          </button>
                        )}

                        <button
                          onClick={() => handleUpdateWaitlistStatus(w.id, 'CANCELLED')}
                          className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 rounded-lg text-xs"
                          title="Remove from waitlist"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Floor Availability Grid */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="font-bold text-slate-900 text-base">
                  Floor Plan — Availability Snapshot
                </h3>
                <span className="text-xs text-slate-500">Instant seat matching</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {tablesList.map((t) => (
                  <div
                    key={t.id}
                    className={`p-3.5 rounded-xl border text-center transition-all ${
                      t.status === 'AVAILABLE'
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                        : t.status === 'OCCUPIED'
                        ? 'bg-rose-50/70 border-rose-300 text-rose-900'
                        : 'bg-amber-50/70 border-amber-300 text-amber-900'
                    }`}
                  >
                    <div className="font-black text-sm">{t.tableCode}</div>
                    <div className="text-xs opacity-80 mt-0.5">
                      {t.capacity} seats · {t.section}
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-wider mt-1.5">
                      {t.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Add Walk-in Guest Form (4 Cols) */}
          <div className="xl:col-span-4 min-w-0">
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <span className="p-2 rounded-xl bg-orange-100 text-orange-600">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Add Walk-in / Waitlist</h3>
                  <p className="text-xs text-slate-500">Enqueue walk-in dining guests</p>
                </div>
              </div>

              <form onSubmit={handleAddWaitlist} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guest Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={wlGuestName}
                    onChange={(e) => setWlGuestName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={wlGuestPhone}
                    onChange={(e) => setWlGuestPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Party Size <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setWlPartySize((p) => Math.max(1, p - 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100"
                    >
                      -
                    </button>
                    <span className="text-base font-extrabold text-slate-900 w-8 text-center">
                      {wlPartySize}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWlPartySize((p) => Math.min(40, p + 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100"
                    >
                      +
                    </button>
                    <span className="text-xs text-slate-500 ml-auto">Guests</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Area Preference
                  </label>
                  <select
                    value={wlSectionPref}
                    onChange={(e) => setWlSectionPref(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="ANY">Any Available Section</option>
                    {sections.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Est. Wait Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={wlWaitMinutes}
                    onChange={(e) => setWlWaitMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Willing to share high table"
                    value={wlNotes}
                    onChange={(e) => setWlNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingWl}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-sm transition-colors text-sm disabled:opacity-50"
                >
                  {isSubmittingWl ? 'Adding...' : 'Add to Waitlist'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assign Table Modal */}
      {assignTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Seat Guest at Table</h3>
            <p className="text-xs text-slate-500">
              Select an available table to seat this guest and update restaurant occupancy.
            </p>

            <select
              value={selectedTableForAssignment}
              onChange={(e) => setSelectedTableForAssignment(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
            >
              <option value="">Select a table...</option>
              {tablesList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tableCode} ({t.capacity} seats, {t.section}) — {t.status}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  setAssignTableModalOpen(false);
                  setActionWaitlistId(null);
                  setSelectedTableForAssignment('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (actionWaitlistId) {
                    handleUpdateWaitlistStatus(
                      actionWaitlistId,
                      'SEATED',
                      selectedTableForAssignment || undefined
                    );
                  }
                  setAssignTableModalOpen(false);
                  setActionWaitlistId(null);
                  setSelectedTableForAssignment('');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                Confirm Seating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
