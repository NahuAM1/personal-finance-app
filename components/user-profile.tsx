'use client';

import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Settings, Crown, Star, Users, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react';
import { USER_ROLES } from '@/types/database';
import { AdminUsersDialog } from '@/components/admin-users-dialog';
import { ChartPreferencesDialog } from '@/components/chart-preferences-dialog';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import SmartPocketLogo from '@/assets/images/smartPocketLogo.svg';

export function UserProfile() {
  const { user, signOut, role, isAdmin } = useAuth();
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [showChartPrefsDialog, setShowChartPrefsDialog] = useState(false);
  const [prefsExpanded, setPrefsExpanded] = useState(false);

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const getInitials = (email: string) => {
    return email
      .split('@')[0]
      .split('.')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = () => {
    switch (role) {
      case USER_ROLES.ADMIN:
        return (
          <span className="flex items-center justify-center gap-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full">
            <Crown className="w-3 h-3" />
            Admin
          </span>
        );
      case USER_ROLES.PREMIUM:
        return (
          <span className="flex items-center justify-center gap-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-2 py-0.5 rounded-full">
            <Star className="w-3 h-3" />
            Premium
          </span>
        );
      default:
        return (
          <span className="flex items-center justify-center gap-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 px-2 py-0.5 rounded-full">
            Free
          </span>
        );
    }
  };

  return (
    <>
    <AdminUsersDialog open={showAdminDialog} onOpenChange={setShowAdminDialog} />
    <ChartPreferencesDialog open={showChartPrefsDialog} onOpenChange={setShowChartPrefsDialog} />
    <DropdownMenu onOpenChange={(open) => { if (!open) setPrefsExpanded(false); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='relative h-10 w-auto px-2 rounded-full'
        >
          <div className='flex items-center gap-2'>
            <Avatar className='h-8 w-8'>
              <AvatarImage
                src={user.user_metadata?.avatar_url || ''}
                alt={user.email || ''}
              />
              <AvatarFallback className='bg-blue-600 text-white'>
                {getInitials(user.email || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className='hidden md:block text-left'>
              <div className='text-sm font-medium'>
                {user.user_metadata?.full_name || 'Usuario'}
              </div>
              {getRoleBadge()}
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56' align='end' forceMount>
        <DropdownMenuLabel className='font-normal'>
          <div className='flex flex-col space-y-1'>
            <p className='text-sm font-medium leading-none'>
              {user.user_metadata?.full_name || 'Usuario'}
            </p>
            <p className='text-xs leading-none text-muted-foreground'>
              {user.email}
            </p>
            <div className='pt-1'>
              {getRoleBadge()}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isAdmin && (
          <DropdownMenuItem onClick={() => setShowAdminDialog(true)}>
            <Users className='mr-2 h-4 w-4' />
            <span>Gestionar Usuarios</span>
          </DropdownMenuItem>
        )}
        {(role === USER_ROLES.PREMIUM || role === USER_ROLES.ADMIN) && (
          <DropdownMenuItem asChild>
            <Link href="/smartpocket" className="flex items-center cursor-pointer">
              <Image
                src={SmartPocketLogo}
                alt="SmartPocket"
                width={16}
                height={16}
                className="mr-2 h-4 w-4"
              />
              <span>SmartPocket</span>
            </Link>
          </DropdownMenuItem>
        )}

        {/* Preferencias accordion */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setPrefsExpanded((prev) => !prev);
          }}
          className='flex items-center justify-between cursor-pointer'
        >
          <div className='flex items-center'>
            <Settings className='mr-2 h-4 w-4' />
            <span>Preferencias</span>
          </div>
          {prefsExpanded
            ? <ChevronDown className='h-3 w-3 text-muted-foreground' />
            : <ChevronRight className='h-3 w-3 text-muted-foreground' />
          }
        </DropdownMenuItem>

        {prefsExpanded && (
          <DropdownMenuItem
            onClick={() => setShowChartPrefsDialog(true)}
            className='pl-8 text-sm'
          >
            <BarChart2 className='mr-2 h-4 w-4 text-muted-foreground' />
            <span>Gráficos</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className='text-red-600'>
          <LogOut className='mr-2 h-4 w-4' />
          <span>Cerrar Sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}
