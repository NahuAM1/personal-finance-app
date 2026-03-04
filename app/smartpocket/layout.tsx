'use client';

import type React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SmartPocketLogo from '@/assets/images/smartPocketLogo.svg';

export default function SmartPocketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="smartpocket min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 dark:from-gray-900 dark:to-purple-950">
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="flex items-center justify-between py-3 px-6 mb-6 bg-white/90 backdrop-blur-sm rounded-full shadow-md">
            <Link href="/">
              <Button variant="ghost" size="sm" className="rounded-full">
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Volver</span>
              </Button>
            </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Image src={SmartPocketLogo} alt="" width={28} height={28} aria-hidden="true" className="h-7 w-7" />
              <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                SmartPocket
              </h1>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
