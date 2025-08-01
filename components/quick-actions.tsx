'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/card';
import { Button } from '@/ui/button';
import {
  PlusCircle,
  TrendingUp,
  CreditCard,
  PiggyBank,
  MapPin,
  DollarSign,
} from 'lucide-react';

export function QuickActions() {
  const actions = [
    {
      title: 'Cargar Gastos',
      description: 'Registra un nuevo gasto',
      icon: PlusCircle,
      color: 'bg-red-500 hover:bg-red-600',
      href: '#expenses',
    },
    {
      title: 'Cargar Ingresos',
      description: 'Registra un nuevo ingreso',
      icon: TrendingUp,
      color: 'bg-green-500 hover:bg-green-600',
      href: '#expenses',
    },
    {
      title: 'Gastos con Tarjeta',
      description: 'Registra compras en cuotas',
      icon: CreditCard,
      color: 'bg-blue-500 hover:bg-blue-600',
      href: '#credit',
    },
    {
      title: 'Ahorros',
      description: 'Gestiona tus metas de ahorro',
      icon: PiggyBank,
      color: 'bg-purple-500 hover:bg-purple-600',
      href: '#savings',
    },
    {
      title: 'Planes de Gastos',
      description: 'Planifica gastos futuros como viajes',
      icon: MapPin,
      color: 'bg-orange-500 hover:bg-orange-600',
      href: '#plans',
    },
    {
      title: 'Ver Dashboard',
      description: 'Resumen completo de tus finanzas',
      icon: DollarSign,
      color: 'bg-indigo-500 hover:bg-indigo-600',
      href: '#dashboard',
    },
  ];

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Accede rápidamente a las funciones más utilizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.title}
                  variant='outline'
                  className='h-auto p-6 flex flex-col items-center gap-3 hover:shadow-lg transition-all bg-transparent'
                  onClick={() => {
                    const tabTrigger = document.querySelector(
                      `[value="${action.href.slice(1)}"]`
                    ) as HTMLElement;
                    if (tabTrigger) {
                      tabTrigger.click();
                    }
                  }}
                >
                  <div
                    className={`p-3 rounded-full text-white ${action.color}`}
                  >
                    <Icon className='h-6 w-6' />
                  </div>
                  <div className='text-center'>
                    <div className='font-semibold'>{action.title}</div>
                    <div className='text-sm text-gray-600 mt-1'>
                      {action.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-gray-600'>
              Balance del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>+$45,230</div>
            <p className='text-xs text-gray-600 mt-1'>Ingresos menos gastos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-gray-600'>
              Gastos Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-orange-600'>$12,400</div>
            <p className='text-xs text-gray-600 mt-1'>Próximas cuotas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-gray-600'>
              Meta de Ahorro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-blue-600'>42%</div>
            <p className='text-xs text-gray-600 mt-1'>Progreso general</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-gray-600'>
              Categoría Top
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-purple-600'>
              Alimentación
            </div>
            <p className='text-xs text-gray-600 mt-1'>Mayor gasto del mes</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
