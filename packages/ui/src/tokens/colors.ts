// Verified design tokens extracted directly from reference screenshots
export const tokens = {
  colors: {
    // Authentication shell
    auth: {
      sidebarNavy: '#08172F',
      primaryBlue: '#002CE8',
      surface: '#FFFFFF',
      border: '#E2E8F0',
      textMuted: '#64748B',
    },
    // Customer experience
    customer: {
      primaryOrange: '#DE5803',
      hoverOrange: '#C64E02',
      badgeBg: '#FFF7ED',
      badgeText: '#C2410C',
      surface: '#FFFFFF',
      background: '#F8FAFC',
    },
    // Staff operational dashboards
    staff: {
      operationalOrange: '#EF5301',
      urgentRed: '#DC2626',
      readyGreen: '#16A34A',
      preparingAmber: '#D97706',
      surface: '#FFFFFF',
      border: '#E2E8F0',
    },
    // Owner business management
    owner: {
      primaryOrange: '#FD5001',
      peachTint: '#FEDFCE',
      cardSurface: '#FFFFFF',
      navActive: '#FD5001',
    },
    // Super Admin enterprise platform
    admin: {
      platformBlue: '#005CFE',
      platformHover: '#004FD6',
      badgeBlue: '#EFF6FF',
      surface: '#FFFFFF',
      canvas: '#F8FAFC',
    },
    // Semantic system colors
    semantic: {
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#2563EB',
      neutral: {
        50: '#F8FAFC',
        100: '#F1F5F9',
        200: '#E2E8F0',
        300: '#CBD5E1',
        400: '#94A3B8',
        500: '#64748B',
        600: '#475569',
        700: '#334155',
        800: '#1E293B',
        900: '#0F172A',
      },
    },
  },
  radii: {
    sm: '0.375rem',  // 6px
    md: '0.5rem',    // 8px - buttons
    lg: '0.75rem',   // 12px - cards
    xl: '1rem',      // 16px - modals
    full: '9999px',  // badges / pills
  },
} as const;
