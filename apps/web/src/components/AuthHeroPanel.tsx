import React from 'react';
import Link from 'next/link';
import { BistroLogo } from './BistroLogo';
import type { LucideIcon } from 'lucide-react';

export interface AuthHeroFeature {
  icon: LucideIcon;
  label: string;
}

interface AuthHeroPanelProps {
  titlePrefix: string;
  titleHighlight: string;
  subtitle: string;
  features: AuthHeroFeature[];
  footerBadge?: string;
  className?: string;
}

export function AuthHeroPanel({
  titlePrefix,
  titleHighlight,
  subtitle,
  features,
  footerBadge,
  className = '',
}: AuthHeroPanelProps) {
  return (
    <div
      className={`relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#070F26] text-white p-10 xl:p-14 ${className}`}
    >
      {/* Background Restaurant Photo with soft overlay */}
      <div
        className="absolute inset-0 z-0 bg-bottom bg-cover bg-no-repeat opacity-40 mix-blend-luminosity"
        style={{ backgroundImage: "url('/auth-hero-photo.png')" }}
      />
      {/* Dark gradient fade for crisp text contrast */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#070F26] via-[#070F26]/85 to-[#070F26]/95 pointer-events-none" />

      {/* Ambient warm lamp light glow */}
      <div
        className="absolute -bottom-20 left-1/3 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Header: Logo */}
      <div className="relative z-10">
        <Link href="/" className="inline-block transition hover:opacity-95">
          <BistroLogo theme="light" size="lg" />
        </Link>
      </div>

      {/* Middle: Title, Subtitle, Feature Pillars */}
      <div className="relative z-10 my-auto py-8 space-y-6 max-w-lg">
        <h1 className="text-3xl font-extrabold tracking-tight text-white xl:text-4xl leading-tight">
          {titlePrefix}{' '}
          <span className="text-[#38BDF8]">{titleHighlight}</span>
        </h1>

        <p className="text-sm leading-relaxed text-slate-300 font-normal">
          {subtitle}
        </p>

        {/* Features with rounded square blue badge */}
        <div className="space-y-3 pt-2">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={idx} className="flex items-center gap-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0E3A8A]/80 border border-blue-400/25 text-blue-300 shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-slate-200">
                  {feat.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Badge */}
      {footerBadge && (
        <div className="relative z-10 pt-4">
          <span className="inline-block text-[11px] font-medium tracking-wide text-slate-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            {footerBadge}
          </span>
        </div>
      )}

      {/* Bottom Wave Divider (SVG curve into right canvas) */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute top-0 right-0 h-full w-14 translate-x-1/2 text-[#F8FAFC] fill-current pointer-events-none hidden xl:block"
        aria-hidden="true"
      >
        <path d="M0 0 C 60 30, 60 70, 0 100 L 100 100 L 100 0 Z" />
      </svg>
    </div>
  );
}
