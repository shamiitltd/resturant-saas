import Link from 'next/link';
import { ArrowRight, UtensilsCrossed, Shield, Lock } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg">
          <UtensilsCrossed className="h-8 w-8" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">RestoSaaS Platform</h1>
          <p className="mt-2 text-sm text-slate-600">
            Multi-tenant restaurant operating and digital ordering system
          </p>
        </div>

        <div className="space-y-3 pt-4">
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#002CE8] py-3 text-sm font-semibold text-white shadow-md hover:bg-[#0025C5] transition"
          >
            <span>Staff & Owner Login</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/register"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800 shadow-xs hover:bg-slate-50 transition"
          >
            <span>Register New Restaurant</span>
          </Link>
        </div>

        <div className="flex justify-center items-center gap-4 text-xs text-slate-400 pt-6">
          <span className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            Supabase RLS Protected
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Lock className="h-3.5 w-3.5 text-blue-500" />
            JWT Verification
          </span>
        </div>
      </div>
    </div>
  );
}
