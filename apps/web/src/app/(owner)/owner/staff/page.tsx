'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users2,
  UserCheck,
  Clock,
  Calendar,
  LogOut,
  Store,
  ShieldCheck,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Crown,
  Headphones,
  Bell,
  Calculator,
  ChefHat,
  UtensilsCrossed,
  Layers,
  Lock,
  Key,
  Smartphone,
  Eye,
  RefreshCw,
  X,
  FileSpreadsheet,
  Zap,
  SlidersHorizontal,
  Check,
  Shield,
  History,
  Activity,
  Laptop,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import type {
  StaffMemberDto,
  StaffRoleSummaryDto,
  StaffLocationAccessDto,
  RoleDto,
  PermissionDto,
  StaffStatsDto,
  StaffActivityLogDto,
  StaffStatus,
} from '@restaurant-saas/contracts';

type ActiveStaffTab = 'staff' | 'roles' | 'policies' | 'logs';

export default function OwnerStaffPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveStaffTab>('staff');

  // Live Database States
  const [staffList, setStaffList] = useState<StaffMemberDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [outlets, setOutlets] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [stats, setStats] = useState<StaffStatsDto | null>(null);
  const [activityLogs, setActivityLogs] = useState<StaffActivityLogDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [outletFilter, setOutletFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected Role for Tab 1 preview
  const [previewRoleId, setPreviewRoleId] = useState<string>('');
  const [rolePreviewTab, setRolePreviewTab] = useState<'permissions' | 'staff' | 'outlets'>('permissions');

  // Staff Drawer State (Add / Edit)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isEditingStaff, setIsEditingStaff] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRoleId, setFormRoleId] = useState('');
  const [formLocationIds, setFormLocationIds] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState<StaffStatus>('ACTIVE');

  // Role Modal / Configuration State (Tab 2)
  const [selectedConfigRoleId, setSelectedConfigRoleId] = useState<string>('');
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePermIds, setNewRolePermIds] = useState<string[]>([]);

  // Toast Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Fetch Real Live Data from Backend
  const loadData = async () => {
    try {
      setLoading(true);
      const [staffRes, rolesRes, permsRes, statsRes, locsRes, logsRes] = await Promise.allSettled([
        fetchWithAuth<StaffMemberDto[]>('/v1/owner/staff'),
        fetchWithAuth<RoleDto[]>('/v1/owner/staff/roles/all'),
        fetchWithAuth<PermissionDto[]>('/v1/owner/staff/permissions/all'),
        fetchWithAuth<StaffStatsDto>('/v1/owner/staff/stats'),
        fetchWithAuth<any[]>('/v1/tenants/current/locations'),
        fetchWithAuth<StaffActivityLogDto[]>('/v1/owner/staff/activity-logs'),
      ]);

      if (staffRes.status === 'fulfilled' && Array.isArray(staffRes.value)) {
        setStaffList(staffRes.value);
      }
      if (rolesRes.status === 'fulfilled' && Array.isArray(rolesRes.value)) {
        setRoles(rolesRes.value);
        if (rolesRes.value.length > 0) {
          if (!previewRoleId) {
            setPreviewRoleId(rolesRes.value[0].id);
          }
          if (!selectedConfigRoleId) {
            setSelectedConfigRoleId(rolesRes.value[0].id);
          }
        }
      }
      if (permsRes.status === 'fulfilled' && Array.isArray(permsRes.value)) {
        setPermissions(permsRes.value);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
      }
      if (locsRes.status === 'fulfilled' && Array.isArray(locsRes.value)) {
        setOutlets(locsRes.value.map((l: any) => ({ id: l.id, name: l.name, code: l.code })));
      }
      if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value)) {
        setActivityLogs(logsRes.value);
      }
    } catch (err) {
      console.warn('Error loading staff & roles data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 2. Filtered Staff Members
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.fullName.toLowerCase().includes(q);
        const matchEmail = s.email.toLowerCase().includes(q);
        const matchPhone = s.phone?.toLowerCase().includes(q) || false;
        if (!matchName && !matchEmail && !matchPhone) return false;
      }
      if (roleFilter !== 'all' && s.role.code !== roleFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (outletFilter !== 'all' && !s.locations.some((l) => l.id === outletFilter)) return false;
      return true;
    });
  }, [staffList, searchQuery, roleFilter, statusFilter, outletFilter]);

  // Selected Role Object for Preview (Tab 1)
  const activePreviewRole = useMemo(() => {
    return roles.find((r) => r.id === previewRoleId) || roles[0] || null;
  }, [roles, previewRoleId]);

  // Selected Role Object for Configuration (Tab 2)
  const activeConfigRole = useMemo(() => {
    return roles.find((r) => r.id === selectedConfigRoleId) || roles[0] || null;
  }, [roles, selectedConfigRoleId]);

  // Group permissions by module
  const permissionsByModule = useMemo(() => {
    const map: Record<string, PermissionDto[]> = {};
    permissions.forEach((p) => {
      const mod = p.module || 'General';
      if (!map[mod]) map[mod] = [];
      map[mod].push(p);
    });
    return map;
  }, [permissions]);

  // ---------------------------------------------------------------------------
  // Staff CRUD Handlers
  // ---------------------------------------------------------------------------

  const handleOpenAddStaff = () => {
    setIsEditingStaff(false);
    setEditingStaffId(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    const defaultRole = roles.find((r) => r.code === 'WAITER') || roles[0];
    setFormRoleId(defaultRole?.id || '');
    setFormLocationIds(outlets.length > 0 ? [outlets[0].id] : []);
    setFormStatus('ACTIVE');
    setActiveTab('staff');
    setDrawerOpen(true);
  };

  const handleOpenEditStaff = (staff: StaffMemberDto) => {
    setIsEditingStaff(true);
    setEditingStaffId(staff.id);
    setFormName(staff.fullName);
    setFormEmail(staff.email);
    setFormPhone(staff.phone || '');
    setFormRoleId(staff.role.id || roles.find((r) => r.code === staff.role.code)?.id || roles[0]?.id || '');
    setFormLocationIds(staff.locations.map((l) => l.id));
    setFormStatus(staff.status);
    setActiveTab('staff');
    setDrawerOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!formName.trim()) {
      showNotification('Please enter the staff member full name', 'error');
      return;
    }
    if (!formEmail.trim() || !formEmail.includes('@')) {
      showNotification('Please enter a valid email address', 'error');
      return;
    }

    const effectiveRoleId = formRoleId || (roles.length > 0 ? roles[0].id : '');
    if (!effectiveRoleId) {
      showNotification('Please select a role', 'error');
      return;
    }

    try {
      if (isEditingStaff && editingStaffId) {
        const updated = await fetchWithAuth<StaffMemberDto>(`/v1/owner/staff/${editingStaffId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fullName: formName.trim(),
            phone: formPhone.trim() || undefined,
            roleId: effectiveRoleId,
            locationIds: formLocationIds,
            status: formStatus,
          }),
        });

        setStaffList((prev) =>
          prev.map((s) => (s.id === editingStaffId ? updated : s))
        );
        showNotification(`Updated profile for ${formName.trim()}`);
      } else {
        const created = await fetchWithAuth<StaffMemberDto>('/v1/owner/staff', {
          method: 'POST',
          body: JSON.stringify({
            fullName: formName.trim(),
            email: formEmail.trim(),
            phone: formPhone.trim() || undefined,
            roleId: effectiveRoleId,
            locationIds: formLocationIds,
            status: formStatus,
          }),
        });

        setStaffList((prev) => [created, ...prev]);
        showNotification(`Added staff member ${formName.trim()}`);
      }

      setDrawerOpen(false);
      // Refresh stats
      fetchWithAuth<StaffStatsDto>('/v1/owner/staff/stats').then(setStats).catch(() => {});
    } catch (err: any) {
      showNotification(err.message || 'Failed to save staff member', 'error');
    }
  };

  const handleToggleStaffStatus = async (staff: StaffMemberDto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextStatus: StaffStatus =
      staff.status === 'ACTIVE'
        ? 'ON_LEAVE'
        : staff.status === 'ON_LEAVE'
        ? 'INACTIVE'
        : 'ACTIVE';

    try {
      const updated = await fetchWithAuth<StaffMemberDto>(`/v1/owner/staff/${staff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });

      setStaffList((prev) => prev.map((s) => (s.id === staff.id ? updated : s)));
      showNotification(`${staff.fullName} is now marked as ${nextStatus.replace('_', ' ')}`);
      fetchWithAuth<StaffStatsDto>('/v1/owner/staff/stats').then(setStats).catch(() => {});
    } catch (err: any) {
      showNotification(err.message || 'Failed to update status', 'error');
    }
  };

  const handleDeleteStaff = async (staffId: string, staffName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Are you sure you want to deactivate and remove access for "${staffName}"?`)) return;

    try {
      await fetchWithAuth(`/v1/owner/staff/${staffId}`, { method: 'DELETE' });
      setStaffList((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, status: 'INACTIVE' } : s))
      );
      showNotification(`Deactivated ${staffName}`);
      fetchWithAuth<StaffStatsDto>('/v1/owner/staff/stats').then(setStats).catch(() => {});
    } catch (err: any) {
      showNotification(err.message || 'Failed to deactivate staff member', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Role CRUD Handlers
  // ---------------------------------------------------------------------------

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      showNotification('Please enter a role name', 'error');
      return;
    }

    try {
      const created = await fetchWithAuth<RoleDto>('/v1/owner/staff/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDesc.trim() || undefined,
          permissionIds: newRolePermIds,
        }),
      });

      setRoles((prev) => [...prev, created]);
      setSelectedConfigRoleId(created.id);
      setPreviewRoleId(created.id);
      setRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setNewRolePermIds([]);
      showNotification(`Created custom role "${created.name}"`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to create role', 'error');
    }
  };

  const handleTogglePermissionForRole = async (permId: string) => {
    if (!activeConfigRole) return;
    if (activeConfigRole.isSystemRole) {
      showNotification('System default roles are protected and cannot be modified', 'error');
      return;
    }

    const currentPermIds = activeConfigRole.permissions.map((p) => p.id);
    const hasPerm = currentPermIds.includes(permId);
    const updatedPermIds = hasPerm
      ? currentPermIds.filter((id) => id !== permId)
      : [...currentPermIds, permId];

    try {
      const updated = await fetchWithAuth<RoleDto>(`/v1/owner/staff/roles/${activeConfigRole.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissionIds: updatedPermIds }),
      });

      setRoles((prev) => prev.map((r) => (r.id === activeConfigRole.id ? updated : r)));
      showNotification(`Updated permissions for ${activeConfigRole.name}`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to update role permissions', 'error');
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete custom role "${roleName}"?`)) return;

    try {
      await fetchWithAuth(`/v1/owner/staff/roles/${roleId}`, { method: 'DELETE' });
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (selectedConfigRoleId === roleId) {
        setSelectedConfigRoleId(roles[0]?.id || '');
      }
      showNotification(`Deleted role "${roleName}"`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete role', 'error');
    }
  };

  // CSV Report Export
  const handleExportCSV = () => {
    let csv = 'ID,Full Name,Email,Phone,Role,Outlet Access,Status,Joined Date\n';
    staffList.forEach((s) => {
      const outletsStr = s.locations.map((l) => l.name).join('; ');
      csv += `"${s.id}","${s.fullName}","${s.email}","${s.phone || 'N/A'}","${s.role.name}","${outletsStr}","${s.status}","${s.joinedAt.slice(0, 10)}"\n`;
    });

    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `staff_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Downloaded Staff Directory CSV');
  };

  const getRoleIcon = (code: string) => {
    switch (code?.toUpperCase()) {
      case 'OWNER':
        return Crown;
      case 'MANAGER':
        return Crown;
      case 'RECEPTIONIST':
      case 'CASHIER':
        return Headphones;
      case 'CHEF':
        return ChefHat;
      case 'WAITER':
        return UtensilsCrossed;
      default:
        return Users2;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-bold shadow-2xl animate-fade-in text-white ${
            notification.type === 'error'
              ? 'bg-red-600'
              : notification.type === 'info'
              ? 'bg-slate-800'
              : 'bg-slate-900'
          }`}
        >
          {notification.type === 'error' ? (
            <XCircle className="h-4 w-4 text-red-300 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* 1. Header Section matching 05-staff-roles-management.png */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#FF4E00] border border-orange-100 shadow-xs">
            <Users2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Staff &amp; Roles Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manage your restaurant staff, roles, permissions and access across all outlets.
            </p>
          </div>
        </div>

        {/* Action Buttons on Right */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadData}
            title="Refresh staff records"
            suppressHydrationWarning
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            suppressHydrationWarning
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Staff Report</span>
          </button>
          <button
            type="button"
            onClick={() => showNotification('CSV Bulk Import wizard ready for processing', 'info')}
            suppressHydrationWarning
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <Upload className="h-4 w-4 text-slate-500" />
            <span>Bulk Import</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddStaff}
            suppressHydrationWarning
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-[#FF4E00] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs matching 05-staff-roles-management.png */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold border-b border-slate-200/80">
        {[
          { id: 'staff', label: 'Staff Overview', count: staffList.length },
          { id: 'roles', label: 'Roles & Permissions', count: roles.length },
          { id: 'policies', label: 'Access Policies', count: 4 },
          { id: 'logs', label: 'Activity Logs', count: activityLogs.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as ActiveStaffTab)}
            suppressHydrationWarning
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 transition flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-[#FF4E00] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 3. Top Stat Cards (7 Metrics matching 05-staff-roles-management.png) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100">
            <Users2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">{stats?.totalStaff ?? staffList.length}</p>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">Total Staff</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">
              {stats?.activeStaff ?? staffList.filter((s) => s.status === 'ACTIVE').length}
            </p>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">Active Staff</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">
              {stats?.onLeaveStaff ?? staffList.filter((s) => s.status === 'ON_LEAVE').length}
            </p>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">On Leave</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">
              {stats?.invitedStaff ?? staffList.filter((s) => s.status === 'INVITED').length}
            </p>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">Joining Soon</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">
              {stats?.inactiveStaff ?? staffList.filter((s) => s.status === 'INACTIVE').length}
            </p>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">Exited (30d)</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">{stats?.totalOutlets ?? outlets.length}</p>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">Outlets</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">{stats?.totalRoles ?? roles.length}</p>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">Roles</span>
          </div>
        </div>
      </div>

      {/* =======================================================================
          TAB 1: STAFF OVERVIEW (2-Column Split View)
      ======================================================================== */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Staff Members List */}
          <div className="lg:col-span-8 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-4">
            {/* Table Header & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Staff Members ({filteredStaff.length})
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Assigned staff across all active outlets
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search staff by name, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    suppressHydrationWarning
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 w-44"
                  />
                </div>

                <select
                  aria-label="Filter by outlet"
                  value={outletFilter}
                  onChange={(e) => setOutletFilter(e.target.value)}
                  suppressHydrationWarning
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Outlets</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by role"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  suppressHydrationWarning
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  suppressHydrationWarning
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="INVITED">Invited</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            {/* Staff Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 w-8">
                      <input
                        type="checkbox"
                        suppressHydrationWarning
                        className="rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                    </th>
                    <th className="pb-3">Staff</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Outlet</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Joined On</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Users2 className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-xs text-slate-700">No staff members found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Try adjusting your search query or filters
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((staff) => {
                      const initial = staff.fullName.charAt(0).toUpperCase();
                      const RoleIcon = getRoleIcon(staff.role.code);

                      return (
                        <tr
                          key={staff.id}
                          className="hover:bg-slate-50/70 transition cursor-pointer"
                          onClick={() => {
                            const foundRole = roles.find((r) => r.code === staff.role.code);
                            if (foundRole) setPreviewRoleId(foundRole.id);
                          }}
                        >
                          <td className="py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              suppressHydrationWarning
                              className="rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                            />
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[#FF4E00] font-black text-xs">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate leading-tight">
                                  {staff.fullName}
                                </p>
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {staff.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold text-[11px]">
                              <RoleIcon className="h-3 w-3 text-[#FF4E00]" />
                              <span>{staff.role.name}</span>
                            </span>
                          </td>
                          <td className="py-3 text-slate-600 font-medium text-[11px]">
                            {staff.locations && staff.locations.length > 0
                              ? staff.locations.map((l) => l.name).join(', ')
                              : 'All Outlets'}
                          </td>
                          <td className="py-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleToggleStaffStatus(staff, e)}
                              title="Click to cycle status: Active -> On Leave -> Inactive"
                              suppressHydrationWarning
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer transition hover:opacity-80"
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  staff.status === 'ACTIVE'
                                    ? 'bg-emerald-500'
                                    : staff.status === 'ON_LEAVE'
                                    ? 'bg-amber-500'
                                    : staff.status === 'INVITED'
                                    ? 'bg-blue-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                              <span
                                className={
                                  staff.status === 'ACTIVE'
                                    ? 'text-emerald-700'
                                    : staff.status === 'ON_LEAVE'
                                    ? 'text-amber-700'
                                    : staff.status === 'INVITED'
                                    ? 'text-blue-700'
                                    : 'text-slate-500'
                                }
                              >
                                {staff.status.replace('_', ' ')}
                              </span>
                            </button>
                          </td>
                          <td className="py-3 text-slate-400 text-[11px]">
                            {staff.joinedAt ? staff.joinedAt.slice(0, 10) : 'Recent'}
                          </td>
                          <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditStaff(staff)}
                                title="Edit staff profile"
                                suppressHydrationWarning
                                className="p-1.5 text-slate-400 hover:text-slate-800 transition rounded-lg hover:bg-slate-100"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteStaff(staff.id, staff.fullName, e)}
                                title="Deactivate staff"
                                suppressHydrationWarning
                                className="p-1.5 text-slate-400 hover:text-red-600 transition rounded-lg hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>
                {filteredStaff.length === 0
                  ? 'Showing 0 of 0 staff'
                  : `Showing 1 – ${filteredStaff.length} of ${filteredStaff.length} staff`}
              </span>
              <div className="flex items-center gap-1 font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-[#FF4E00] text-white">1</span>
              </div>
            </div>
          </div>

          {/* Right Column: Role Details Preview (matching 05-staff-roles-management.png right column) */}
          <div className="lg:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="space-y-4">
              {activePreviewRole ? (
                <>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100">
                        <Crown className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">
                          Role: {activePreviewRole.name}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {activePreviewRole.isSystemRole ? 'System Protected Role' : 'Custom Tenant Role'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedConfigRoleId(activePreviewRole.id);
                        setActiveTab('roles');
                      }}
                      suppressHydrationWarning
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Edit2 className="h-3 w-3 text-slate-500" />
                      <span>Edit Role</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {activePreviewRole.description ||
                      'Full operational and service capabilities for assigned restaurant staff members.'}
                  </p>

                  {/* Sub-tabs within Role Card */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setRolePreviewTab('permissions')}
                      suppressHydrationWarning
                      className={`flex-1 py-1.5 rounded-lg transition text-center ${
                        rolePreviewTab === 'permissions'
                          ? 'bg-[#FF4E00] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Permissions
                    </button>
                    <button
                      type="button"
                      onClick={() => setRolePreviewTab('staff')}
                      suppressHydrationWarning
                      className={`flex-1 py-1.5 rounded-lg transition text-center ${
                        rolePreviewTab === 'staff'
                          ? 'bg-[#FF4E00] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Assigned Staff ({activePreviewRole.assignedStaffCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRolePreviewTab('outlets')}
                      suppressHydrationWarning
                      className={`flex-1 py-1.5 rounded-lg transition text-center ${
                        rolePreviewTab === 'outlets'
                          ? 'bg-[#FF4E00] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Outlets ({outlets.length})
                    </button>
                  </div>

                  {/* Role Permissions Checklist */}
                  {rolePreviewTab === 'permissions' && (
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {Object.entries(permissionsByModule).map(([modName, perms]) => {
                        const hasAll = perms.every((p) =>
                          activePreviewRole.permissions.some((rp) => rp.id === p.id)
                        );
                        const hasSome = perms.some((p) =>
                          activePreviewRole.permissions.some((rp) => rp.id === p.id)
                        );

                        return (
                          <div
                            key={modName}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-4 w-4 items-center justify-center rounded-md ${
                                    hasAll
                                      ? 'bg-[#FF4E00] text-white'
                                      : hasSome
                                      ? 'bg-orange-200 text-orange-900'
                                      : 'bg-slate-200 text-slate-400'
                                  }`}
                                >
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </div>
                                <span className="font-extrabold text-xs text-slate-900">{modName}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {perms.filter((p) => activePreviewRole.permissions.some((rp) => rp.id === p.id)).length} / {perms.length}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 pl-6">
                              {perms.map((p) => p.description).slice(0, 2).join(', ')}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {rolePreviewTab === 'staff' && (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {staffList.filter((s) => s.role.code === activePreviewRole.code).length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-6 italic">
                          No staff members currently assigned to this role
                        </p>
                      ) : (
                        staffList
                          .filter((s) => s.role.code === activePreviewRole.code)
                          .map((staff) => (
                            <div
                              key={staff.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-[#FF4E00] font-black text-xs">
                                  {staff.fullName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{staff.fullName}</p>
                                  <span className="text-[10px] text-slate-400">{staff.email}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                {staff.status}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  )}

                  {rolePreviewTab === 'outlets' && (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {outlets.map((outlet) => (
                        <div
                          key={outlet.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-slate-400" />
                            <span className="font-bold text-slate-900">{outlet.name}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                            {outlet.code || 'ACTIVE'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-xs text-slate-400 py-12">Select a role to inspect permissions</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: ROLES & PERMISSIONS CONFIGURATION (Matching 25-role-permission-configuration.png)
      ======================================================================== */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Column 1: Roles List */}
          <div className="lg:col-span-3 rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Roles ({roles.length})
              </h2>
              <button
                type="button"
                onClick={() => setRoleModalOpen(true)}
                suppressHydrationWarning
                className="flex items-center gap-1 rounded-lg bg-orange-50 border border-orange-200 px-2 py-1 text-[11px] font-bold text-orange-700 hover:bg-orange-100 transition"
              >
                <Plus className="h-3 w-3" />
                <span>New Role</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {roles.map((role) => {
                const isSelected = selectedConfigRoleId === role.id;
                const RoleIcon = getRoleIcon(role.code);

                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedConfigRoleId(role.id)}
                    className={`group flex items-center justify-between p-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50 border border-orange-200 text-orange-900 shadow-xs'
                        : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isSelected ? 'bg-[#FF4E00] text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <RoleIcon className="h-4 w-4" />
                      </div>
                      <div className="truncate">
                        <p className="font-extrabold text-slate-900 leading-tight">{role.name}</p>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {role.assignedStaffCount} assigned
                        </span>
                      </div>
                    </div>

                    {!role.isSystemRole && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(role.id, role.name);
                        }}
                        title="Delete custom role"
                        suppressHydrationWarning
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Edit Role & Granular Permissions Matrix */}
          <div className="lg:col-span-6 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-5">
            {activeConfigRole ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900">
                        Edit Role: {activeConfigRole.name}
                      </h3>
                      {activeConfigRole.isSystemRole ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                          System Role
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
                          Custom Role
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeConfigRole.description || 'Configure granular permissions for this role.'}
                    </p>
                  </div>
                </div>

                {/* Granular Permissions Matrix */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Select permissions for this role:</span>
                    {activeConfigRole.isSystemRole && (
                      <span className="text-[11px] text-amber-600 font-bold flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        <span>System Protected</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[460px] overflow-y-auto pr-1">
                    {Object.entries(permissionsByModule).map(([modName, perms]) => (
                      <div key={modName} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                          <span className="font-extrabold text-xs text-slate-900">{modName}</span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {perms.filter((p) => activeConfigRole.permissions.some((rp) => rp.id === p.id)).length} / {perms.length}
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          {perms.map((perm) => {
                            const isChecked = activeConfigRole.permissions.some((p) => p.id === perm.id);

                            return (
                              <label
                                key={perm.id}
                                className={`flex items-start gap-2 text-xs cursor-pointer select-none ${
                                  activeConfigRole.isSystemRole ? 'cursor-not-allowed opacity-90' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={activeConfigRole.isSystemRole}
                                  checked={isChecked}
                                  onChange={() => handleTogglePermissionForRole(perm.id)}
                                  suppressHydrationWarning
                                  className="mt-0.5 rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                                />
                                <span className={isChecked ? 'font-bold text-slate-900' : 'text-slate-600'}>
                                  {perm.description}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-xs text-slate-400 py-16">Select a role to configure permissions</p>
            )}
          </div>

          {/* Column 3: Role Summary Card (Matching 25-role-permission-configuration.png) */}
          <div className="lg:col-span-3 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 pb-2 border-b border-slate-100">
              Role Summary
            </h3>

            {activeConfigRole && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Role Name:</span>
                  <span className="font-bold text-slate-900">{activeConfigRole.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Type:</span>
                  <span className="font-bold text-slate-900">
                    {activeConfigRole.isSystemRole ? 'System Template' : 'Custom Role'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Users Assigned:</span>
                  <span className="font-bold text-orange-600">{activeConfigRole.assignedStaffCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Outlet Scope:</span>
                  <span className="font-bold text-slate-900">All Outlets ({outlets.length})</span>
                </div>

                {/* Stat Box */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-orange-50 border border-orange-100 text-center">
                  <div>
                    <p className="text-lg font-black text-[#FF4E00] leading-none">
                      {Object.keys(permissionsByModule).length}
                    </p>
                    <span className="text-[10px] text-orange-900 font-bold mt-1 block">Modules</span>
                  </div>
                  <div>
                    <p className="text-lg font-black text-[#FF4E00] leading-none">
                      {activeConfigRole.permissions.length}
                    </p>
                    <span className="text-[10px] text-orange-900 font-bold mt-1 block">Permissions</span>
                  </div>
                </div>

                {/* Key Access checkmarks */}
                <div>
                  <span className="font-bold text-slate-700 block mb-2">Enabled Capabilities:</span>
                  <div className="space-y-1.5 text-[11px]">
                    {Object.keys(permissionsByModule).map((mod) => {
                      const enabledCount = activeConfigRole.permissions.filter((p) => p.module === mod).length;
                      if (enabledCount === 0) return null;
                      return (
                        <div key={mod} className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>{mod}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: ACCESS POLICIES & SECURITY SETTINGS
      ======================================================================== */}
      {activeTab === 'policies' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Restaurant Access Policies</h2>
              <p className="text-xs text-slate-500">
                Configure terminal security, session durations, and staff role safeguards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[#FF4E00]">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Auto Session Inactivity Logout</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Automatically lock POS &amp; KDS screens after 15 minutes of inactivity to protect cashier terminals.
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Enabled (15 mins)
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Multi-Factor Authentication (MFA)</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Strongly recommended for Owner and Manager accounts per TRD security architecture.
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Enforced for Owners
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Waiter Quick PIN Switch</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Allows servers to punch orders on shared station tablets using 4-digit PINs without re-logging in.
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                    Active on Table Service
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Branch Location Boundary Guard</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Staff assigned to Pitampura cannot view orders or modify menus for Rohini branch.
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Enforced by Backend RLS
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: ACTIVITY LOGS & LOGIN SESSIONS (Matching 27-staff-activity-logs.png)
      ======================================================================== */}
      {activeTab === 'logs' && (
        <div className="space-y-5">
          {/* Top Activity Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00]">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 leading-none">{activityLogs.length}</p>
                <span className="text-[11px] text-slate-500 font-medium mt-1 block">Total Audit Records</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Laptop className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 leading-none">{staffList.length}</p>
                <span className="text-[11px] text-slate-500 font-medium mt-1 block">Active Sessions</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 leading-none">
                  {staffList.filter((s) => s.status === 'ACTIVE').length}
                </p>
                <span className="text-[11px] text-slate-500 font-medium mt-1 block">Active Staff</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-black text-emerald-700 leading-none">0</p>
                <span className="text-[11px] text-slate-500 font-medium mt-1 block">Failed Logins</span>
              </div>
            </div>
          </div>

          {/* Activity Logs Table */}
          <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Activity Log &amp; Audit Trail</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Detailed record of staff actions, security events and state updates
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activityLogs, null, 2));
                  const dlAnchor = document.createElement('a');
                  dlAnchor.setAttribute('href', dataStr);
                  dlAnchor.setAttribute('download', `activity_logs_${Date.now()}.json`);
                  dlAnchor.click();
                  showNotification('Exported audit logs as JSON');
                }}
                suppressHydrationWarning
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export Logs</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Time</th>
                    <th className="pb-3">Staff</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Details</th>
                    <th className="pb-3">Outlet</th>
                    <th className="pb-3 text-right">IP / Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 italic">
                        No activity records captured yet
                      </td>
                    </tr>
                  ) : (
                    activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {log.createdAt.slice(0, 16).replace('T', ' ')}
                        </td>
                        <td className="py-2.5 font-bold text-slate-900 whitespace-nowrap">
                          {log.actorName}
                        </td>
                        <td className="py-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {log.actorRole}
                          </span>
                        </td>
                        <td className="py-2.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              log.action.includes('CREATED')
                                ? 'bg-emerald-50 text-emerald-700'
                                : log.action.includes('DEACTIVATED') || log.action.includes('DELETED')
                                ? 'bg-red-50 text-red-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600 text-[11px] max-w-xs truncate">
                          {log.details}
                        </td>
                        <td className="py-2.5 text-slate-500 text-[11px] whitespace-nowrap">
                          {log.outletName}
                        </td>
                        <td className="py-2.5 text-right font-mono text-[10px] text-slate-400 whitespace-nowrap">
                          {log.ipAddress}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Bottom Quick Actions Section matching 05-staff-roles-management.png */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#FF4E00]" />
          <span className="text-xs font-extrabold text-slate-900">Quick Actions</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleOpenAddStaff}
            suppressHydrationWarning
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <Plus className="h-3.5 w-3.5 text-orange-600" />
            <span>Add Staff</span>
          </button>
          <button
            type="button"
            onClick={() => setRoleModalOpen(true)}
            suppressHydrationWarning
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
            <span>Create Role</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('policies')}
            suppressHydrationWarning
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <Lock className="h-3.5 w-3.5 text-slate-500" />
            <span>Access &amp; Security</span>
          </button>
        </div>
      </div>

      {/* Modal: Create Custom Role */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-[#FF4E00]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">Create Custom Role</h3>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                suppressHydrationWarning
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Role Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Floor Supervisor"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  suppressHydrationWarning
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe operational responsibilities for this role..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  suppressHydrationWarning
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Initial Permissions</label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-3 bg-slate-50">
                  {permissions.map((perm) => {
                    const isChecked = newRolePermIds.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className="flex items-center gap-2 text-[11px] cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setNewRolePermIds((prev) =>
                              isChecked ? prev.filter((id) => id !== perm.id) : [...prev, perm.id]
                            );
                          }}
                          suppressHydrationWarning
                          className="rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span className={isChecked ? 'font-bold text-slate-900' : 'text-slate-600'}>
                          [{perm.module}] {perm.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                suppressHydrationWarning
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRole}
                suppressHydrationWarning
                className="flex-1 px-4 py-2 rounded-xl bg-[#FF4E00] text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
              >
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Staff Member */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-[#FF4E00]">
                  <Users2 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {isEditingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                suppressHydrationWarning
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Karan Mehta"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  suppressHydrationWarning
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Address *</label>
                <input
                  type="email"
                  disabled={isEditingStaff}
                  placeholder="karan@spicegarden.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  suppressHydrationWarning
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98765 43216"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  suppressHydrationWarning
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assigned Role *</label>
                <select
                  value={formRoleId || (roles.length > 0 ? roles[0].id : '')}
                  onChange={(e) => setFormRoleId(e.target.value)}
                  suppressHydrationWarning
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.isSystemRole ? '(Default)' : '(Custom)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Outlet Access</label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {outlets.map((outlet) => {
                    const isSelected = formLocationIds.includes(outlet.id);
                    return (
                      <button
                        key={outlet.id}
                        type="button"
                        onClick={() => {
                          setFormLocationIds((prev) =>
                            isSelected ? prev.filter((id) => id !== outlet.id) : [...prev, outlet.id]
                          );
                        }}
                        suppressHydrationWarning
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          isSelected
                            ? 'bg-orange-50 border-orange-200 text-orange-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected && '✓ '}
                        {outlet.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Account Status</label>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  {(['ACTIVE', 'ON_LEAVE', 'INVITED', 'INACTIVE'] as StaffStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFormStatus(st)}
                      suppressHydrationWarning
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition capitalize ${
                        formStatus === st
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {st.replace('_', ' ').toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                suppressHydrationWarning
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStaff}
                suppressHydrationWarning
                className="flex-1 px-4 py-2 rounded-xl bg-[#FF4E00] text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
              >
                {isEditingStaff ? 'Save Changes' : 'Create Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
