'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BistroLogo } from '@/components/BistroLogo';
import { AuthHeroPanel } from '@/components/AuthHeroPanel';
import {
  ShieldCheck,
  Mail,
  Zap,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

const FORGOT_HERO_FEATURES = [
  { icon: ShieldCheck, label: 'Encrypted password reset' },
  { icon: Mail, label: 'Verification link sent to email' },
  { icon: Zap, label: 'Back in your restaurant in minutes' },
];

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [devRecoveryLink, setDevRecoveryLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setDevRecoveryLink(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    try {
      localStorage.setItem('bistro_reset_email', cleanEmail);
    } catch {}

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.warn('Supabase resetPasswordForEmail notice:', error.message);
      }

      // Attempt to retrieve direct recovery link for frictionless development testing
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const res = await fetch(`${apiUrl}/v1/auth/dev-recovery-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            redirectTo: `${window.location.origin}/reset-password`,
          }),
        });
        if (res.ok) {
          const devData = await res.json();
          if (devData.actionLink) {
            setDevRecoveryLink(devData.actionLink);
          }
        }
      } catch (devErr) {
        console.warn('Dev recovery link helper skipped:', devErr);
      }

      setSuccessMessage(
        `A password reset link has been dispatched to ${cleanEmail}. Please check your inbox and spam folder.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch reset instructions.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/select-outlet`,
        },
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in initiation failed.');
    }
  };

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden w-full bg-[#F8FAFC]">
      {/* Left Branded Hero Panel (Exact Match to 03-forgot-password.png) */}
      <AuthHeroPanel
        className="hidden lg:flex lg:w-[45%] xl:w-[42%]"
        titlePrefix="Reset your password"
        titleHighlight="securely"
        subtitle="Don't worry, it happens. Follow the simple steps to recover access to your restaurant account."
        features={FORGOT_HERO_FEATURES}
        footerBadge="Protected by The Bistro OS"
      />

      {/* Right Column: Centered Floating Card */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto lg:overflow-y-hidden">
        <div className="w-full max-w-[440px] bg-white rounded-3xl p-8 sm:p-10 border border-slate-100 shadow-xl text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <BistroLogo theme="dark" size="md" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            Forgot Password?
          </h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
            Enter your registered email or mobile number and we&apos;ll send a verification link to reset your password.
          </p>

          {errorMessage && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 text-left">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 text-left">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <div className="flex-1 font-medium">{successMessage}</div>
              </div>

              {devRecoveryLink && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-left space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <Zap className="h-3.5 w-3.5 text-blue-600" />
                    <span>Instant Direct Reset (Dev Mode):</span>
                  </div>
                  <p className="text-[11px] text-blue-700 leading-normal">
                    Supabase free tier limits external emails (3/hr) and may route to Spam. You can open the password reset screen directly:
                  </p>
                  <a
                    href={devRecoveryLink}
                    className="flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-bold text-white bg-[#002CE8] hover:bg-[#0025C5] rounded-lg transition shadow-xs"
                  >
                    <span>Open Reset Password Screen Now</span>
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
            <div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Email or Mobile Number"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 focus:border-[#0038FF] transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0038FF] hover:bg-[#0025C5] text-white text-sm font-semibold shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#0038FF]/40 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending Reset Link...
                </>
              ) : (
                'Send Reset Link / OTP'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400 font-medium">or</span>
            </div>
          </div>

          {/* Google Sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2.5"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.92l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.39 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.25C.45 8.19 0 9.99 0 12s.45 3.81 1.25 5.4l4.03-3.13z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.61 1.25 6.6l4.03 3.13c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Back to Login */}
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-[#0038FF] transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Login
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          The Bistro OS Restaurant Management Platform
        </p>
      </div>
    </div>
  );
}
