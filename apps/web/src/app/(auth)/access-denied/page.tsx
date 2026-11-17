import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AccessDeniedPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 shadow-sm">
        <ShieldAlert className="h-8 w-8" />
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">403 — Access Denied</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          You do not have the required role or permissions to access this restaurant resource.
          Access is strictly isolated by tenant and branch assignment.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 text-left space-y-2">
        <p className="font-semibold text-slate-800">Possible reasons:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>You are assigned to a different branch than the one currently requested.</li>
          <li>Your role (e.g. Waiter or Chef) does not have access to administrative or billing functions.</li>
          <li>Your active session has expired or your tenant membership was suspended.</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Link
          href="/select-outlet"
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#002CE8] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0025C5] transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Switch Outlet / Branch
        </Link>
        <Link
          href="/login"
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Login
        </Link>
      </div>
    </div>
  );
}
