import type React from 'react';
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Toaster } from 'sonner';
import { FormProvider } from '@/contexts/form-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Personal Wallet',
  description: 'Gestiona tus finanzas de manera inteligente',
  icons: {
    icon: '/favicon.ico',
  },
  applicationName: 'Personal Wallet',
  authors: [{ name: 'Personal Wallet Team' }],
  keywords: ['finanzas', 'presupuesto', 'gastos', 'ingresos', 'ahorro'],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='es' className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className={GeistSans.className}>
        <FormProvider>
          {children}
          <Toaster
            richColors
            position='bottom-center'
            toastOptions={{
              role: 'status',
              'aria-live': 'polite',
            }}
          />
        </FormProvider>
      </body>
    </html>
  );
}
