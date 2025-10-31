'use client';

import Image from 'next/image';
import Logo from '@/assets/images/logo.svg';

export function Loader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="relative w-48 h-48">
        <div className="absolute -top-2.5 -left-2.5 w-56 h-56 border-4 border-transparent border-t-[#7a9b6e] border-r-[#d4af7a] rounded-full animate-spin" />

        <Image
          src={Logo}
          width={192}
          height={192}
          alt="Logo"
          className="w-full h-full animate-pulse-custom"
        />
      </div>

      <style jsx>{`
        @keyframes pulse-custom {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(0.95);
            opacity: 0.8;
          }
        }

        .animate-pulse-custom {
          animation: pulse-custom 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
