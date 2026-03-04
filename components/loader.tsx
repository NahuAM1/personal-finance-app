'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import Logo from '@/assets/images/logo.svg';
import SmartPocketLogo from '@/assets/images/smartPocketLogo.svg';

const themes = {
  default: {
    logo: Logo,
    alt: 'Personal Wallet',
    label: 'Personal Wallet',
    container: 'fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-gray-950 dark:via-emerald-950/20 dark:to-gray-950',
    blobA: 'absolute -top-40 -right-40 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl animate-pulse',
    blobB: 'absolute -bottom-40 -left-40 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl animate-pulse',
    glow: 'absolute inset-0 w-48 h-48 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur-xl opacity-30 animate-pulse',
    ringSize: 'relative w-48 h-48',
    ringA: 'absolute -inset-3 rounded-full border-4 border-transparent border-t-emerald-500 border-r-teal-400 animate-spin',
    ringB: 'absolute -inset-3 rounded-full border-4 border-transparent border-b-emerald-300 border-l-teal-300 animate-spin',
    disc: 'w-40 h-40 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-xl shadow-emerald-500/10 flex items-center justify-center',
    logoSize: 120,
    text: 'text-lg font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent',
  },
  smartpocket: {
    logo: SmartPocketLogo,
    alt: 'SmartPocket',
    label: 'SmartPocket',
    container: 'flex flex-col items-center justify-center min-h-[60vh]',
    blobA: '',
    blobB: '',
    glow: 'absolute inset-0 w-32 h-32 bg-gradient-to-r from-purple-400 to-violet-400 rounded-full blur-xl opacity-30 animate-pulse',
    ringSize: 'relative w-32 h-32',
    ringA: 'absolute -inset-3 rounded-full border-4 border-transparent border-t-purple-500 border-r-violet-400 animate-spin',
    ringB: 'absolute -inset-3 rounded-full border-4 border-transparent border-b-purple-300 border-l-violet-300 animate-spin',
    disc: 'w-28 h-28 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-xl shadow-purple-500/10 flex items-center justify-center',
    logoSize: 80,
    text: 'text-lg font-semibold bg-gradient-to-r from-purple-600 to-violet-600 dark:from-purple-400 dark:to-violet-400 bg-clip-text text-transparent',
  },
} as const;

export function Loader() {
  const pathname = usePathname();
  const t = pathname?.startsWith('/smartpocket') ? themes.smartpocket : themes.default;

  return (
    <div className={t.container}>
      {/* Decorative background blobs (default theme only) */}
      {t.blobA && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={t.blobA} />
          <div className={t.blobB} style={{ animationDelay: '1s' }} />
        </div>
      )}

      <div className="relative">
        {/* Outer glow ring */}
        <div className={t.glow} />

        {/* Spinning rings */}
        <div className={t.ringSize}>
          <div className={t.ringA} style={{ animationDuration: '1.5s' }} />
          <div className={t.ringB} style={{ animationDuration: '2s', animationDirection: 'reverse' }} />

          {/* Logo container with glass effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={t.disc}>
              <Image
                src={t.logo}
                width={t.logoSize}
                height={t.logoSize}
                alt={t.alt}
                className="animate-pulse-custom"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Loading text */}
      <div className="mt-8 text-center relative z-10">
        <p className={t.text}>Cargando...</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.label}</p>
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
