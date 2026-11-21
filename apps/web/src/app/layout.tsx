import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Restaurant SaaS — Operating & Ordering Platform',
  description: 'Multi-tenant restaurant ordering, operations and customer engagement platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
