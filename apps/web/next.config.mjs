/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@restaurant-saas/contracts', '@restaurant-saas/ui'],
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/staff/kitchen', destination: '/kitchen' },
      { source: '/staff/reception', destination: '/reception' },
      { source: '/staff/billing', destination: '/billing' },
      { source: '/staff/reservations', destination: '/reservations' },
      { source: '/staff/waiter', destination: '/waiter' },
    ];
  },
};

export default nextConfig;
