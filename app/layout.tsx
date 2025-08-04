import type React from 'react';
import type { Metadata } from 'next';
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>
        <FormProvider>
          {children}
          <Toaster richColors position='bottom-center' />
        </FormProvider>
      </body>
    </html>
  );
}
