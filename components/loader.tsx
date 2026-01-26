'use client';

import Image from 'next/image';
import Logo from '@/assets/images/logo.svg';

export function Loader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-gray-950 dark:via-emerald-950/20 dark:to-gray-950">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative">
        {/* Outer glow ring */}
        <div className="absolute inset-0 w-48 h-48 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur-xl opacity-30 animate-pulse" />

        {/* Spinning ring */}
        <div className="relative w-48 h-48">
          <div className="absolute -inset-3 rounded-full border-4 border-transparent border-t-emerald-500 border-r-teal-400 animate-spin" style={{ animationDuration: '1.5s' }} />
          <div className="absolute -inset-3 rounded-full border-4 border-transparent border-b-emerald-300 border-l-teal-300 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />

          {/* Logo container with glass effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-40 h-40 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-xl shadow-emerald-500/10 flex items-center justify-center">
              <Image
                src={Logo}
                width={120}
                height={120}
                alt="Personal Wallet logo"
                className="animate-pulse-custom"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Loading text */}
      <div className="mt-8 text-center relative z-10">
        <p className="text-lg font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
          Cargando...
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Personal Wallet
        </p>
      </div>

      <style jsx>{`
        @keyframes pulse-custom {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(0.95);
            opacity: 0.85;
          }
        }

        .animate-pulse-custom {
          animation: pulse-custom 2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-pulse-custom {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
