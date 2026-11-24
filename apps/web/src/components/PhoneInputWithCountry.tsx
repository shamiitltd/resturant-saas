'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Phone } from 'lucide-react';

export interface CountryCallingCode {
  flag: string;
  name: string;
  code: string;
  iso: string;
}

export const COUNTRY_CODES: CountryCallingCode[] = [
  { flag: '🇮🇳', name: 'India', code: '+91', iso: 'IN' },
  { flag: '🇺🇸', name: 'United States', code: '+1', iso: 'US' },
  { flag: '🇬🇧', name: 'United Kingdom', code: '+44', iso: 'GB' },
  { flag: '🇦🇪', name: 'United Arab Emirates', code: '+971', iso: 'AE' },
  { flag: '🇸🇬', name: 'Singapore', code: '+65', iso: 'SG' },
  { flag: '🇨🇦', name: 'Canada', code: '+1', iso: 'CA' },
  { flag: '🇦🇺', name: 'Australia', code: '+61', iso: 'AU' },
  { flag: '🇸🇦', name: 'Saudi Arabia', code: '+966', iso: 'SA' },
  { flag: '🇩🇪', name: 'Germany', code: '+49', iso: 'DE' },
  { flag: '🇫🇷', name: 'France', code: '+33', iso: 'FR' },
  { flag: '🇶🇦', name: 'Qatar', code: '+974', iso: 'QA' },
];

interface PhoneInputWithCountryProps {
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
  phoneNumber: string;
  onPhoneNumberChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PhoneInputWithCountry({
  countryCode,
  onCountryCodeChange,
  phoneNumber,
  onPhoneNumberChange,
  placeholder = '98765 43210',
  className = '',
  disabled = false,
}: PhoneInputWithCountryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCountry =
    COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits and spaces
    const clean = e.target.value.replace(/[^\d\s]/g, '');
    onPhoneNumberChange(clean);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Country Code Dropdown */}
      <div ref={dropdownRef} className="relative shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs sm:text-sm font-semibold text-slate-800 transition hover:border-slate-300 focus:outline-none focus:border-[#0038FF] focus:ring-2 focus:ring-[#0038FF]/20 ${
            isOpen ? 'border-[#0038FF] ring-2 ring-[#0038FF]/20 shadow-xs' : ''
          }`}
        >
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="font-semibold text-slate-900">{selectedCountry.code}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#0038FF]' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-60 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
            {COUNTRY_CODES.map((c) => {
              const isSelected = c.code === countryCode;
              return (
                <div
                  key={`${c.iso}-${c.code}`}
                  onClick={() => {
                    onCountryCodeChange(c.code);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs sm:text-sm cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#EEF4FF] text-[#0038FF] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-slate-500 font-mono">{c.code}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-[#0038FF] stroke-[2.5]" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Phone Number Input */}
      <div className="relative flex-1">
        <input
          type="tel"
          disabled={disabled}
          value={phoneNumber}
          onChange={handlePhoneInput}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0038FF] focus:outline-none focus:ring-2 focus:ring-[#0038FF]/20 transition"
        />
      </div>
    </div>
  );
}
