'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth, publicFetch } from '@/lib/api';
import { BistroLogo } from '@/components/BistroLogo';
import { AuthHeroPanel } from '@/components/AuthHeroPanel';
import { CustomSelect } from '@/components/CustomSelect';
import { PhoneInputWithCountry } from '@/components/PhoneInputWithCountry';
import {
  CheckCircle2,
  Store,
  MapPin,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Zap,
  BarChart2,
  Users2,
  Cloud,
  Headphones,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  Plus,
} from 'lucide-react';
import type { RegisterOwnerRequestDto, AuthMeResponseDto } from '@restaurant-saas/contracts';

const REGISTER_HERO_FEATURES = [
  { icon: CheckCircle2, label: 'Online Orders & Table Management' },
  { icon: CheckCircle2, label: 'Menu, Staff & Inventory' },
  { icon: CheckCircle2, label: 'Billing, Payments & Reports' },
  { icon: CheckCircle2, label: 'Multi-Outlet & Growth Ready' },
];

const BUSINESS_TYPES = [
  'Restaurant',
  'Cafe / Bistro',
  'Quick Service / QSR',
  'Bar & Brewery',
  'Bakery & Dessert',
  'Cloud Kitchen',
];

const OUTLET_OPTIONS = [
  '1 (Single Outlet)',
  '2 – 5 Outlets',
  '6 – 15 Outlets',
  '16+ Outlets',
];

const COUNTRY_OPTIONS = [
  'India',
  'United States',
  'United Kingdom',
  'United Arab Emirates',
  'Singapore',
  'Canada',
  'Australia',
];

const DESIGNATION_OPTIONS = [
  'Owner / Founder',
  'Managing Director',
  'General Manager',
  'Head Chef / Kitchen Lead',
  'Director of Operations',
];

const POPULAR_CUISINES = [
  'North Indian',
  'South Indian',
  'Chinese',
  'Italian',
  'Continental',
  'Fast Food',
  'Cafe & Bakery',
  'Mughlai',
];

export default function RegisterOwnerPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1: Business Details — initial state empty, informative placeholders
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantSlug, setRestaurantSlug] = useState('');
  const [businessType, setBusinessType] = useState('Restaurant');
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [newCuisineInput, setNewCuisineInput] = useState('');
  const [outletsCount, setOutletsCount] = useState('1 (Single Outlet)');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('India');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Step 2: Owner Details — initial state empty, informative placeholders
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('Owner / Founder');

  // Step 3: Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRestaurantName(val);
    if (!restaurantSlug || restaurantSlug === slugify(restaurantName)) {
      setRestaurantSlug(slugify(val));
    }
  };

  const addCuisine = (cuisineName?: string) => {
    const item = (cuisineName || newCuisineInput).trim();
    if (item && !cuisines.includes(item)) {
      setCuisines([...cuisines, item]);
      if (!cuisineName) {
        setNewCuisineInput('');
      }
    }
  };

  const removeCuisine = (item: string) => {
    setCuisines(cuisines.filter((c) => c !== item));
  };

  const validateStep = (currentStep: number): boolean => {
    setErrorMessage(null);
    if (currentStep === 1) {
      if (!restaurantName.trim()) {
        setErrorMessage('Please enter your restaurant name.');
        return false;
      }
      if (!address.trim()) {
        setErrorMessage('Please enter your restaurant address.');
        return false;
      }
      if (!phoneNumber.trim()) {
        setErrorMessage('Please enter a valid phone number.');
        return false;
      }
      if (!agreeTerms) {
        setErrorMessage('Please agree to the Terms of Service & Privacy Policy.');
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      if (!fullName.trim()) {
        setErrorMessage('Please enter your full name.');
        return false;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage('Please enter a valid email address.');
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      if (!password || password.length < 8) {
        setErrorMessage('Password must be at least 8 characters.');
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setErrorMessage(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const formattedPhone = `${countryCode} ${phoneNumber.trim()}`.trim();

      // Check if user already has an active session
      let session = (await supabase.auth.getSession()).data.session;

      if (!session) {
        // First try to sign in with password in case user was already registered
        const signInAttempt = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInAttempt.data?.session) {
          session = signInAttempt.data.session;
        } else {
          // New user signup
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: fullName.trim(),
                phone: formattedPhone,
              },
            },
          });

          if (authError) {
            throw new Error(authError.message);
          }

          session = authData.session;

          // If no session returned (Supabase email confirmation enabled), try dev-confirm & sign in
          if (!session) {
            try {
              await publicFetch('/v1/auth/dev-confirm', {
                method: 'POST',
                body: JSON.stringify({ email: cleanEmail }),
              });
              const autoSignIn = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password,
              });
              if (autoSignIn.data?.session) {
                session = autoSignIn.data.session;
              }
            } catch (confirmErr) {
              console.warn('Dev auto-confirm fallback not available:', confirmErr);
            }
          }
        }
      }

      const payload: RegisterOwnerRequestDto = {
        email: cleanEmail,
        fullName: fullName.trim(),
        restaurantName: restaurantName.trim(),
        restaurantSlug: restaurantSlug.trim() || slugify(restaurantName),
        primaryOutletName: `${restaurantName.trim()} (Main Outlet)`,
        timezone: 'Asia/Kolkata',
        phone: formattedPhone,
      };

      if (!session) {
        // If email confirmation is strictly enforced by Supabase, save pending details
        try {
          localStorage.setItem('pending_owner_onboarding', JSON.stringify(payload));
          localStorage.setItem('pending_owner_password', password);
        } catch {}
        router.push(`/verify-otp?email=${encodeURIComponent(cleanEmail)}`);
        return;
      }

      // 2. Provision Tenant and Owner atomically via NestJS API
      await fetchWithAuth<AuthMeResponseDto>('/v1/auth/register-owner', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // 3. Clear pending data & redirect directly to Owner Dashboard
      try {
        localStorage.removeItem('pending_owner_onboarding');
        localStorage.removeItem('pending_owner_password');
      } catch {}

      router.push('/owner/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please review your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden w-full bg-[#F8FAFC]">
      {/* Left Branded Hero Panel */}
      <AuthHeroPanel
        className="hidden lg:flex lg:w-[32%] xl:w-[28%] shrink-0"
        titlePrefix="Start your restaurant on"
        titleHighlight="The Bistro OS"
        subtitle="Sign up as a restaurant owner and manage your complete restaurant operations from one unified platform."
        features={REGISTER_HERO_FEATURES}
      />

      {/* Right Content Column — Fitted for Single View with Zero Desktop Scrollbars */}
      <div className="flex flex-1 flex-col justify-center px-4 sm:px-6 lg:px-8 xl:px-12 py-4 lg:py-3 xl:py-5 overflow-y-auto lg:overflow-y-hidden">
        {/* Mobile Header */}
        <div className="mb-4 lg:hidden">
          <BistroLogo theme="dark" size="sm" />
        </div>

        <div className="mx-auto w-full max-w-4xl flex flex-col justify-center my-auto">
          {/* Page Heading — Compact */}
          <div className="mb-2.5 sm:mb-3">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              Create Your Restaurant Account
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Join The Bistro OS and set up your restaurant in minutes.
            </p>
          </div>

          {/* Stepper Navigation — Compact Single Row */}
          <div className="mb-3 sm:mb-4 flex items-center justify-between max-w-xl">
            {[
              { num: 1, label: 'Business Details' },
              { num: 2, label: 'Owner Details' },
              { num: 3, label: 'Set Password' },
              { num: 4, label: 'Review' },
            ].map((s, idx, arr) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                      step >= s.num
                        ? 'bg-[#0038FF] text-white shadow-xs'
                        : 'border-2 border-slate-300 text-slate-500 bg-white'
                    }`}
                  >
                    {s.num}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden sm:inline ${
                      step >= s.num ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2.5 rounded transition ${
                      step > s.num ? 'bg-[#0038FF]' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Main 2-Column Card */}
          <div className="rounded-2xl bg-white p-4 sm:p-5 lg:p-6 shadow-lg border border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
            {/* Left 8 Cols: Form Content */}
            <div className="lg:col-span-8 flex flex-col justify-between">
              <div>
                {errorMessage && (
                  <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div className="flex-1 font-medium">{errorMessage}</div>
                  </div>
                )}

                {/* STEP 1: Business Details */}
                {step === 1 && (
                  <div className="space-y-3">
                    <div className="border-b border-slate-100 pb-2">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">Business Details</h2>
                      <p className="text-xs text-slate-500">Tell us about your restaurant business.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Restaurant Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Store className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={restaurantName}
                            onChange={handleNameChange}
                            placeholder="e.g. Spice Garden Restaurant"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Business Type <span className="text-red-500">*</span>
                        </label>
                        <CustomSelect
                          value={businessType}
                          onChange={setBusinessType}
                          options={BUSINESS_TYPES}
                          placeholder="Select business type"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Cuisine Types
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border border-slate-200 bg-white min-h-[38px]">
                          {cuisines.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center gap-1 rounded-md bg-[#EEF4FF] px-2 py-0.5 text-xs font-semibold text-[#0038FF] border border-[#0038FF]/20"
                            >
                              <span>{c}</span>
                              <button
                                type="button"
                                onClick={() => removeCuisine(c)}
                                className="text-blue-500 hover:text-blue-800"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          <input
                            type="text"
                            value={newCuisineInput}
                            onChange={(e) => setNewCuisineInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addCuisine();
                              }
                            }}
                            placeholder={cuisines.length === 0 ? "Type cuisine & press Enter" : "+ Add more"}
                            className="flex-1 min-w-[100px] bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400 px-1"
                          />
                        </div>

                        {/* Quick Add Suggestions if empty or fewer than 3 */}
                        {cuisines.length < 3 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-slate-400">Suggestions:</span>
                            {POPULAR_CUISINES.filter((pc) => !cuisines.includes(pc))
                              .slice(0, 4)
                              .map((pc) => (
                                <button
                                  key={pc}
                                  type="button"
                                  onClick={() => addCuisine(pc)}
                                  className="text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-[#0038FF] rounded px-1.5 py-0.5 transition"
                                >
                                  + {pc}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Number of Outlets <span className="text-red-500">*</span>
                        </label>
                        <CustomSelect
                          value={outletsCount}
                          onChange={setOutletsCount}
                          options={OUTLET_OPTIONS}
                          placeholder="Select number of outlets"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Restaurant Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="e.g. Sector 8, Pitampura, New Delhi – 110034"
                          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Country <span className="text-red-500">*</span>
                        </label>
                        <CustomSelect
                          value={country}
                          onChange={setCountry}
                          options={COUNTRY_OPTIONS}
                          placeholder="Select country"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <PhoneInputWithCountry
                          countryCode={countryCode}
                          onCountryCodeChange={setCountryCode}
                          phoneNumber={phoneNumber}
                          onPhoneNumberChange={setPhoneNumber}
                          placeholder="98765 43210"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={agreeTerms}
                          onChange={(e) => setAgreeTerms(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-[#0038FF] focus:ring-[#0038FF]"
                        />
                        <span className="text-xs text-slate-600">
                          I agree to the{' '}
                          <a href="#" className="font-semibold text-[#0038FF] underline">
                            Terms
                          </a>{' '}
                          &{' '}
                          <a href="#" className="font-semibold text-[#0038FF] underline">
                            Privacy Policy
                          </a>
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={handleNext}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0038FF] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#002ED6] transition"
                      >
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Owner Details */}
                {step === 2 && (
                  <div className="space-y-3.5">
                    <div className="border-b border-slate-100 pb-2">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">Owner Credentials</h2>
                      <p className="text-xs text-slate-500">Your personal administrator access.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="e.g. Raghav Aggarwal"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Designation / Role
                        </label>
                        <CustomSelect
                          value={designation}
                          onChange={setDesignation}
                          options={DESIGNATION_OPTIONS}
                          placeholder="Select designation"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Work Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="e.g. raghavagg2005@gmail.com"
                          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                        />
                      </div>
                    </div>

                    <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNext}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0038FF] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#002ED6] transition"
                      >
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Password */}
                {step === 3 && (
                  <div className="space-y-3.5">
                    <div className="border-b border-slate-100 pb-2">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">Set Secure Password</h2>
                      <p className="text-xs text-slate-500">Protect your restaurant account and operations.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Confirm Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter your password"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1 border border-slate-200">
                      <p className="font-semibold text-slate-900">Security criteria:</p>
                      <p>• Minimum 8 characters in length</p>
                      <p>• Only share credentials with authorized restaurant managers</p>
                    </div>

                    <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNext}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0038FF] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#002ED6] transition"
                      >
                        <span>Review Setup</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: Review & Launch */}
                {step === 4 && (
                  <div className="space-y-3">
                    <div className="border-b border-slate-100 pb-2">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">Review & Launch</h2>
                      <p className="text-xs text-slate-500">Confirm your setup details before activating your restaurant account.</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Restaurant:</span>
                        <span className="font-bold text-slate-900">{restaurantName || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Type & Outlets:</span>
                        <span className="font-medium text-slate-900">{businessType} ({outletsCount})</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Cuisines:</span>
                        <span className="font-medium text-slate-900">{cuisines.length > 0 ? cuisines.join(', ') : 'None selected'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Address:</span>
                        <span className="font-medium text-slate-900 text-right max-w-[260px] truncate">{address || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="text-slate-500">Owner Name:</span>
                        <span className="font-bold text-slate-900">{fullName || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Login Email:</span>
                        <span className="font-medium text-slate-900">{email || 'Not specified'}</span>
                      </div>
                    </div>

                    <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleSubmit}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0038FF] px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-[#002ED6] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/50 disabled:opacity-60 transition"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Provisioning Restaurant...</span>
                          </>
                        ) : (
                          <>
                            <span>Create Account & Launch</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right 4 Cols: Why Join The Bistro OS Sidebar — Exact Match to 02-owner-registration.png */}
            <div className="lg:col-span-4 rounded-2xl bg-[#F0F5FF] p-4 sm:p-5 border border-blue-100/80 flex flex-col justify-between">
              <div>
                {/* Storefront Illustration */}
                <div className="flex justify-center mb-3">
                  <div className="relative w-40 h-24 sm:w-44 sm:h-26">
                    <Image
                      src="/storefront-illustration.png"
                      alt="The Bistro OS Storefront"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3">
                  Why join The Bistro OS?
                </h3>

                <ul className="space-y-2.5 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <Zap className="h-4 w-4 text-[#0038FF] shrink-0 mt-0.5" />
                    <span className="font-medium text-slate-700">Get up and running quickly</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <BarChart2 className="h-4 w-4 text-[#0038FF] shrink-0 mt-0.5" />
                    <span className="font-medium text-slate-700">Manage operations in one place</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Users2 className="h-4 w-4 text-[#0038FF] shrink-0 mt-0.5" />
                    <span className="font-medium text-slate-700">Support for single or multi-outlet restaurants</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Cloud className="h-4 w-4 text-[#0038FF] shrink-0 mt-0.5" />
                    <span className="font-medium text-slate-700">Secure, scalable and reliable</span>
                  </li>
                </ul>
              </div>

              {/* Need Help Footer */}
              <div className="pt-3.5 mt-3.5 border-t border-blue-200/60 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <Headphones className="h-4 w-4 text-[#0038FF] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900">Need help?</span>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      Contact our support team at{' '}
                      <a href="mailto:support@thebistroos.com" className="text-[#0038FF] font-medium hover:underline">
                        support@thebistroos.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Already have an account */}
          <div className="mt-2.5 sm:mt-3 text-center text-xs text-slate-600">
            <span>Already have an account? </span>
            <Link href="/login" className="font-bold text-[#0038FF] hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
