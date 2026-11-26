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
  Armchair,
  Phone,
  Mail,
  UserCheck,
  RotateCw,
  Check,
  X,
  MessageSquare,
  Edit2,
  Layers,
  MapPin,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import type {
  TableReservationDto,
  ReservationsOverviewDto,
  OwnerTablesOverviewDto,
  OwnerTableDto,
  CreateReservationRequestDto,
} from '@restaurant-saas/contracts';

export default function StaffReservationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterPill, setFilterPill] = useState<'ALL' | 'UPCOMING' | 'TODAY' | 'PAST'>('TODAY');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('ALL');

  // Data
  const [reservationsData, setReservationsData] = useState<ReservationsOverviewDto | null>(null);
  const [tablesList, setTablesList] = useState<OwnerTableDto[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  // Modal states
  const [newReservationModalOpen, setNewReservationModalOpen] = useState(false);
  const [changeTableModalOpen, setChangeTableModalOpen] = useState(false);
  const [assignTableId, setAssignTableId] = useState('');

  // New Reservation Form State
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [resDate, setResDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [resTime, setResTime] = useState('19:30');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const resRes = await fetchWithAuth<ReservationsOverviewDto>(
        `/v1/staff/reservations?date=${selectedDate}`
      );
      if (resRes) {
        setReservationsData(resRes);
        if (resRes.reservations.length > 0 && !selectedReservationId) {
          setSelectedReservationId(resRes.reservations[0].id);
        }
      }

      // Fetch tables for location
      const tablesRes = await fetchWithAuth<OwnerTablesOverviewDto>(`/v1/owner/tables`);
      if (tablesRes?.tables) {
        setTablesList(tablesRes.tables);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Selected reservation object
  const selectedReservation = useMemo(() => {
    if (!reservationsData?.reservations || !selectedReservationId) return null;
    return reservationsData.reservations.find((r) => r.id === selectedReservationId) || null;
  }, [reservationsData, selectedReservationId]);

  // Filtered reservations
  const filteredList = useMemo(() => {
    if (!reservationsData?.reservations) return [];
    return reservationsData.reservations.filter((r) => {
      const q = searchQuery.toLowerCase();
      const match =
        r.guestName.toLowerCase().includes(q) ||
        r.guestPhone.includes(q) ||
        r.reservationCode.toLowerCase().includes(q) ||
        (r.tableCode && r.tableCode.toLowerCase().includes(q));

      if (!match) return false;

      if (filterPill === 'UPCOMING') {
        return r.status === 'CONFIRMED' || r.status === 'PENDING';
      }
      return true;
    });
  }, [reservationsData, searchQuery, filterPill]);

  // Total guest count
  const totalGuests = useMemo(() => {
    if (!reservationsData?.reservations) return 0;
    return reservationsData.reservations.reduce((sum, r) => sum + r.partySize, 0);
  }, [reservationsData]);

  // Unique sections
  const sections = useMemo(() => {
    const s = new Set<string>();
    tablesList.forEach((t) => {
      if (t.section) s.add(t.section);
    });
    return Array.from(s);
  }, [tablesList]);

  // Tables filtered by section
  const floorTables = useMemo(() => {
    if (selectedFloor === 'ALL') return tablesList;
    return tablesList.filter((t) => t.section === selectedFloor);
  }, [tablesList, selectedFloor]);

  // Handle Create Reservation
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestPhone.trim()) {
      setError('Guest name and phone number are required');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const payload: CreateReservationRequestDto = {
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        partySize,
        reservationDate: resDate,
        startTime: resTime,
        tableId: selectedTableId || null,
        specialRequests: specialRequests.trim() || undefined,
        source: 'STAFF',
      };

      const res = await fetchWithAuth<TableReservationDto>('/v1/staff/reservations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res) {
        showToast(`Reservation created: ${res.reservationCode}`);
        setNewReservationModalOpen(false);
        setGuestName('');
        setGuestPhone('');
        setPartySize(2);
        setSelectedTableId('');
        setSpecialRequests('');
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark as arrived / Seated
  const handleMarkAsArrived = async () => {
    if (!selectedReservation) return;
    try {
      setError(null);
      const res = await fetchWithAuth<TableReservationDto>(
        `/v1/staff/reservations/${selectedReservation.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'SEATED',
            tableId: selectedReservation.tableId || undefined,
          }),
        }
      );
      if (res) {
        showToast(`Guest ${selectedReservation.guestName} marked as Seated!`);
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to mark as arrived');
    }
  };

  // Mark as completed / Free table
  const handleMarkAsCompleted = async () => {
    if (!selectedReservation) return;
    try {
      setError(null);
      const res = await fetchWithAuth<TableReservationDto>(
        `/v1/staff/reservations/${selectedReservation.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'COMPLETED',
          }),
        }
      );
      if (res) {
        showToast(`Reservation marked as Completed and table freed!`);
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to complete reservation');
    }
  };

  // Cancel reservation
  const handleCancelBooking = async () => {
    if (!selectedReservation) return;
    if (!confirm(`Cancel booking for ${selectedReservation.guestName}?`)) return;
    try {
      setError(null);
      const res = await fetchWithAuth<TableReservationDto>(
        `/v1/staff/reservations/${selectedReservation.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'CANCELLED',
            cancellationReason: 'Cancelled by staff at front desk',
          }),
        }
      );
      if (res) {
        showToast(`Reservation cancelled`);
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel reservation');
    }
  };

  // Change table
  const handleChangeTable = async () => {
    if (!selectedReservation || !assignTableId) return;
    try {
      setError(null);
      const res = await fetchWithAuth<TableReservationDto>(
        `/v1/staff/reservations/${selectedReservation.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ tableId: assignTableId }),
        }
      );
      if (res) {
        showToast(`Table changed to ${res.tableCode || 'new table'}`);
        setChangeTableModalOpen(false);
        setAssignTableId('');
        loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to change table');
    }
  };

  return (
    <div className="min-w-0 max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600">
            <CalendarIcon className="w-7 h-7" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Reservations & Table Booking
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              Manage table bookings, guest requests and reservation flow.
            </p>
          </div>
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
            onClick={() => setNewReservationModalOpen(true)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Reservation
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2.5 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2.5 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Stat Badges */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Total Bookings</span>
            <div className="text-2xl font-black text-slate-900">
              {reservationsData?.summary.totalReservations ?? 0}
            </div>
          </div>
          <CalendarIcon className="w-6 h-6 text-emerald-500" />
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Total Guests</span>
            <div className="text-2xl font-black text-slate-900">{totalGuests}</div>
          </div>
          <Users className="w-6 h-6 text-orange-500" />
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Confirmed</span>
            <div className="text-2xl font-black text-emerald-600">
              {reservationsData?.summary.confirmed ?? 0}
            </div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Waiting / Pending</span>
            <div className="text-2xl font-black text-amber-600">
              {reservationsData?.summary.pending ?? 0}
            </div>
          </div>
          <Clock className="w-6 h-6 text-amber-500" />
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Cancelled</span>
            <div className="text-2xl font-black text-rose-600">
              {reservationsData?.summary.cancelled ?? 0}
            </div>
          </div>
          <XCircle className="w-6 h-6 text-rose-500" />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setFilterPill('TODAY')}
            className={`px-3 py-1.5 rounded-xl transition-colors ${
              filterPill === 'TODAY'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Today ({reservationsData?.reservations.length ?? 0})
          </button>
          <button
            onClick={() => setFilterPill('UPCOMING')}
            className={`px-3 py-1.5 rounded-xl transition-colors ${
              filterPill === 'UPCOMING'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilterPill('ALL')}
            className={`px-3 py-1.5 rounded-xl transition-colors ${
              filterPill === 'ALL'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Bookings
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* 3-Column Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        {/* Col 1: Booking List (3.5 Cols) */}
        <div className="lg:col-span-4 space-y-3 min-w-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, phone or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredList.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-semibold">No bookings found</p>
              </div>
            ) : (
              filteredList.map((r) => {
                const isSelected = selectedReservationId === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReservationId(r.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-orange-50/70 border-orange-400 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-sm truncate">{r.guestName}</div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
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
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
                      <span className="font-medium text-slate-700">
                        {r.startTime.slice(0, 5)} · {r.partySize} Guests
                      </span>
                      {r.tableCode ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-800 text-[11px]">
                          {r.tableCode}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No table</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Col 2: Floor Map / Table Availability (4.5 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4 min-w-0">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Armchair className="w-4 h-4 text-orange-600" />
              Floor Map Availability
            </h3>

            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700"
            >
              <option value="ALL">All Sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Table Grid */}
          <div className="grid grid-cols-2 gap-2.5 max-h-[500px] overflow-y-auto">
            {floorTables.map((t) => (
              <div
                key={t.id}
                className={`p-3 rounded-xl border text-center transition-all ${
                  t.status === 'AVAILABLE'
                    ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    : t.status === 'OCCUPIED'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="font-black text-sm">{t.tableCode}</div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {t.capacity} Seats · {t.section}
                </div>
                <div
                  className={`mt-1 text-[10px] font-bold uppercase ${
                    t.status === 'AVAILABLE'
                      ? 'text-slate-500'
                      : t.status === 'OCCUPIED'
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {t.status}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 pt-2 border-t">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Occupied
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border" /> Available
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Reserved
            </span>
          </div>
        </div>

        {/* Col 3: Selected Reservation Details (4 Cols) */}
        <div className="lg:col-span-4 min-w-0">
          {selectedReservation ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Reservation Details</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    selectedReservation.status === 'CONFIRMED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : selectedReservation.status === 'SEATED'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : selectedReservation.status === 'COMPLETED'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {selectedReservation.status}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-slate-800">
                  <span className="p-2 rounded-lg bg-slate-100 text-slate-600">
                    <Users className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="font-black text-sm text-slate-900">
                      {selectedReservation.guestName}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {selectedReservation.reservationCode}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-slate-700">
                  <span className="p-2 rounded-lg bg-slate-100 text-slate-600">
                    <Phone className="w-4 h-4" />
                  </span>
                  <span className="font-mono">{selectedReservation.guestPhone}</span>
                </div>

                <div className="flex items-center gap-2.5 text-slate-700">
                  <span className="p-2 rounded-lg bg-slate-100 text-slate-600">
                    <Clock className="w-4 h-4" />
                  </span>
                  <span>
                    {selectedReservation.reservationDate} · {selectedReservation.startTime.slice(0, 5)} -{' '}
                    {selectedReservation.endTime.slice(0, 5)}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 text-slate-700">
                  <span className="p-2 rounded-lg bg-slate-100 text-slate-600">
                    <Armchair className="w-4 h-4" />
                  </span>
                  <span>
                    Table:{' '}
                    <strong className="text-slate-900">
                      {selectedReservation.tableCode || 'Unassigned'}
                    </strong>{' '}
                    ({selectedReservation.partySize} guests)
                  </span>
                </div>

                {selectedReservation.specialRequests && (
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-amber-900 text-[11px] italic">
                    "{selectedReservation.specialRequests}"
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {selectedReservation.status === 'SEATED' ? (
                  <button
                    onClick={handleMarkAsCompleted}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Mark as Completed & Clear Table
                  </button>
                ) : selectedReservation.status === 'CONFIRMED' || selectedReservation.status === 'PENDING' ? (
                  <button
                    onClick={handleMarkAsArrived}
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-4 h-4" />
                    Mark as Arrived & Seated
                  </button>
                ) : (
                  <div className="text-center py-2 text-xs font-semibold text-slate-400">
                    Reservation is {selectedReservation.status.toLowerCase()}
                  </div>
                )}

                {selectedReservation.status !== 'COMPLETED' && selectedReservation.status !== 'CANCELLED' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setChangeTableModalOpen(true)}
                      className="py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <Armchair className="w-3.5 h-3.5" />
                      Change Table
                    </button>

                    <button
                      onClick={handleCancelBooking}
                      className="py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel Booking
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-semibold">Select a reservation to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* New Reservation Modal */}
      {newReservationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-lg">New Table Reservation</h3>
              <button
                onClick={() => setNewReservationModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Guest Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rohan Mehta"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Party Size *</label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={partySize}
                    onChange={(e) => setPartySize(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Time Slot *</label>
                  <input
                    type="time"
                    required
                    value={resTime}
                    onChange={(e) => setResTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assign Table (Optional)</label>
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Auto / On Arrival</option>
                  {tablesList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tableCode} ({t.capacity} seats, {t.section})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Special Requests</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Birthday dinner, arrange small cake"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setNewReservationModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Confirm Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Table Modal */}
      {changeTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">Change Assigned Table</h3>
            <p className="text-slate-500">
              Select a new table for {selectedReservation?.guestName}.
            </p>

            <select
              value={assignTableId}
              onChange={(e) => setAssignTableId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-semibold"
            >
              <option value="">Select Table...</option>
              {tablesList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tableCode} ({t.capacity} seats, {t.section})
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setChangeTableModalOpen(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangeTable}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold"
              >
                Save Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
