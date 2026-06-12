import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AuthSessionProvider } from '@/components/providers/session-provider';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LMS — Loan Management System',
  description:
    'Connect lenders and borrowers in one place. Evidence-based applications, structured reviews, and repayment tracking.',
  icons: {
    icon: [
      { url: '/brand/lms-icon-colored.png', type: 'image/png' },
    ],
    apple: '/brand/lms-icon-colored.png',
    shortcut: '/brand/lms-icon-colored.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} font-sans`}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
