'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Investment } from '@/types/database';
import { TrendingUp, Calendar, DollarSign, Percent } from 'lucide-react';

interface InvestmentLiquidateFormProps {
  investments: Investment[];
  onLiquidate: (investmentId: string, actualReturn: number) => void;
  onCurrencySale: (investmentId: string, unitsSold: number, sellExchangeRate: number) => void;
}

const investmentTypeLabels: Record<string, string> = {
  plazo_fijo: 'Plazo Fijo',
  fci: 'FCI',
  bonos: 'Bonos',
  acciones: 'Acciones',
  crypto: 'Crypto',
  letras: 'Letras',
  cedears: 'CEDEARs',
  cauciones: 'Cauciones',
  fondos_comunes_inversion: 'Fondos Comunes de Inversión',
  compra_divisas: 'Compra de Divisas',
};

export function InvestmentLiquidateForm({ investments, onLiquidate, onCurrencySale }: InvestmentLiquidateFormProps) {
  const [selectedInvestment, setSelectedInvestment] = useState('');
  // For regular investments: total amount received
  const [totalReceived, setTotalReceived] = useState('');
  // For currency investments
  const [unitsToSell, setUnitsToSell] = useState('');
  const [sellExchangeRate, setSellExchangeRate] = useState('');

  const activeInvestments = investments.filter((inv) => !inv.is_liquidated);

  const selectedInvestmentData = activeInvestments.find(
    (inv) => inv.id === selectedInvestment
  );

  const isCurrencyInvestment = selectedInvestmentData?.investment_type === 'compra_divisas';

  // Calculate total currency units available
  const totalCurrencyUnits = isCurrencyInvestment && selectedInvestmentData?.exchange_rate
    ? selectedInvestmentData.amount / selectedInvestmentData.exchange_rate
    : 0;

  // Calculate profit/loss for currency investments
  const currencySaleAmount = unitsToSell && sellExchangeRate
    ? Number.parseFloat(unitsToSell) * Number.parseFloat(sellExchangeRate)
    : 0;

  // Calculate the proportional cost of the units being sold
  const proportionalCost = isCurrencyInvestment && selectedInvestmentData?.exchange_rate && unitsToSell
    ? Number.parseFloat(unitsToSell) * selectedInvestmentData.exchange_rate
    : 0;

  const currencyReturn = currencySaleAmount - proportionalCost;

  // Calculate profit/loss for regular investments
  const regularReturn = totalReceived && selectedInvestmentData
    ? Number.parseFloat(totalReceived) - selectedInvestmentData.amount
    : 0;

  const handleLiquidate = () => {
    if (!selectedInvestment || !selectedInvestmentData) return;

    if (isCurrencyInvestment) {
      if (!unitsToSell || !sellExchangeRate) return;
      // Use the new currency sale function that handles partial sales
      onCurrencySale(
        selectedInvestment,
        Number.parseFloat(unitsToSell),
        Number.parseFloat(sellExchangeRate)
      );
    } else {
      if (!totalReceived) return;
      onLiquidate(selectedInvestment, regularReturn);
    }

    // Reset form
    setSelectedInvestment('');
    setTotalReceived('');
    setUnitsToSell('');
    setSellExchangeRate('');
  };

  // Set all units when selecting currency investment
  const handleSetAllUnits = () => {
    setUnitsToSell(totalCurrencyUnits.toFixed(2));
  };

  if (activeInvestments.length === 0) {
    return (
      <Card className='bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'>
        <CardContent className='pt-6'>
          <div className='text-center py-8'>
            <TrendingUp className='h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2'>
              No hay inversiones activas
            </h3>
            <p className='text-blue-600 dark:text-blue-400'>
              Crea una inversión desde la pestaña &quot;Nueva Inversión&quot;
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      <Card className='bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'>
        <CardHeader>
          <CardTitle className='text-amber-800 dark:text-amber-200'>
            Liquidar Inversión
          </CardTitle>
          <CardDescription>
            Al liquidar, se creará automáticamente un ingreso con el capital + ganancias (o - pérdidas)
          </CardDescription>
        </CardHeader>
      </Card>

      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='investment-select'>Selecciona la inversión a liquidar</Label>
          <Select
            value={selectedInvestment}
            onValueChange={(value) => {
              setSelectedInvestment(value);
              setTotalReceived('');
              setUnitsToSell('');
              setSellExchangeRate('');
            }}
          >
            <SelectTrigger id='investment-select'>
              <SelectValue placeholder='Elige la inversión' />
            </SelectTrigger>
            <SelectContent>
              {activeInvestments.map((investment) => {
                const isMatured = investment.maturity_date
                  ? new Date() >= new Date(investment.maturity_date)
                  : false;
                return (
                  <SelectItem key={investment.id} value={investment.id}>
                    <div className='flex items-center justify-between gap-4 w-full'>
                      <span className='font-medium'>{investment.description}</span>
                      <span className='text-xs text-gray-500'>
                        {investmentTypeLabels[investment.investment_type]}
                      </span>
                      <span className='font-semibold'>
                        ${investment.amount.toLocaleString('es-AR')}
                      </span>
                      {isMatured && <span className='text-xs text-green-600 font-semibold'>✓ Vencida</span>}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedInvestmentData && (
          <Card className='bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'>
            <CardContent className='pt-6'>
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300'>
                    Inversión:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {selectedInvestmentData.description}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300'>
                    Tipo:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {investmentTypeLabels[selectedInvestmentData.investment_type]}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                    <DollarSign className='h-4 w-4' />
                    Capital Invertido:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    ${selectedInvestmentData.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                    <Calendar className='h-4 w-4' />
                    Inicio:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {format(new Date(selectedInvestmentData.start_date), "dd 'de' MMMM, yyyy", { locale: es })}
                  </span>
                </div>

                {selectedInvestmentData.maturity_date && (
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                      <Calendar className='h-4 w-4' />
                      Vencimiento:
                    </span>
                    <span className='font-medium text-blue-900 dark:text-blue-100'>
                      {format(new Date(selectedInvestmentData.maturity_date), "dd 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>
                )}

                {selectedInvestmentData.annual_rate && (
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                      <Percent className='h-4 w-4' />
                      TNA:
                    </span>
                    <span className='font-medium text-blue-900 dark:text-blue-100'>
                      {selectedInvestmentData.annual_rate}%
                    </span>
                  </div>
                )}

                {/* Currency specific info */}
                {isCurrencyInvestment && selectedInvestmentData.currency && selectedInvestmentData.exchange_rate && (
                  <>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm text-blue-700 dark:text-blue-300'>
                        Divisa:
                      </span>
                      <span className='font-medium text-blue-900 dark:text-blue-100'>
                        {selectedInvestmentData.currency}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm text-blue-700 dark:text-blue-300'>
                        TC Compra:
                      </span>
                      <span className='font-medium text-blue-900 dark:text-blue-100'>
                        ${selectedInvestmentData.exchange_rate.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm text-blue-700 dark:text-blue-300'>
                        Unidades Disponibles:
                      </span>
                      <span className='font-bold text-emerald-600 dark:text-emerald-400'>
                        {totalCurrencyUnits.toLocaleString('es-AR', { minimumFractionDigits: 2 })} {selectedInvestmentData.currency}
                      </span>
                    </div>
                  </>
                )}

                {!isCurrencyInvestment && selectedInvestmentData.estimated_return > 0 && (
                  <div className='pt-3 border-t border-blue-200 dark:border-blue-800'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-blue-700 dark:text-blue-300'>
                        Ganancia estimada:
                      </span>
                      <span className='font-semibold text-green-600 dark:text-green-400'>
                        +${selectedInvestmentData.estimated_return.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}

                <div className='text-xs text-blue-600 dark:text-blue-400'>
                  Días transcurridos: {differenceInDays(new Date(), new Date(selectedInvestmentData.start_date))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Currency Investment Liquidation Form */}
        {selectedInvestment && isCurrencyInvestment && selectedInvestmentData && (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='units-to-sell'>Cantidad de {selectedInvestmentData.currency} a vender</Label>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleSetAllUnits}
                  className='text-xs'
                >
                  Vender todo
                </Button>
              </div>
              <Input
                id='units-to-sell'
                type='number'
                step='0.01'
                placeholder={`Máx: ${totalCurrencyUnits.toFixed(2)}`}
                value={unitsToSell}
                onChange={(e) => {
                  const value = Number.parseFloat(e.target.value);
                  if (value > totalCurrencyUnits) {
                    setUnitsToSell(totalCurrencyUnits.toFixed(2));
                  } else {
                    setUnitsToSell(e.target.value);
                  }
                }}
                max={totalCurrencyUnits}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='sell-exchange-rate'>Tipo de Cambio de Venta (ARS)</Label>
              <Input
                id='sell-exchange-rate'
                type='number'
                step='0.01'
                placeholder='1150.00'
                value={sellExchangeRate}
                onChange={(e) => setSellExchangeRate(e.target.value)}
                required
              />
            </div>

            {unitsToSell && sellExchangeRate && Number.parseFloat(sellExchangeRate) > 0 && Number.parseFloat(unitsToSell) > 0 && (
              <Card className={`${currencyReturn >= 0 ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                <CardContent className='pt-4'>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className={currencyReturn >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                        Vendiendo:
                      </span>
                      <span className={`font-medium ${currencyReturn >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                        {Number.parseFloat(unitsToSell).toLocaleString('es-AR', { minimumFractionDigits: 2 })} {selectedInvestmentData.currency}
                      </span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className={currencyReturn >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                        Costo proporcional:
                      </span>
                      <span className={`font-medium ${currencyReturn >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                        ${proportionalCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className={currencyReturn >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                        Monto a recibir:
                      </span>
                      <span className={`font-medium ${currencyReturn >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                        ${currencySaleAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className='pt-2 border-t border-current opacity-20' />
                    <div className='flex items-center justify-between'>
                      <span className={`font-semibold ${currencyReturn >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {currencyReturn >= 0 ? 'Ganancia:' : 'Pérdida:'}
                      </span>
                      <span className={`font-bold text-xl ${currencyReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {currencyReturn >= 0 ? '+' : ''}${currencyReturn.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className='flex items-center justify-between text-xs'>
                      <span className={currencyReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        Variación TC:
                      </span>
                      <span className={`font-medium ${currencyReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {(((Number.parseFloat(sellExchangeRate) - (selectedInvestmentData.exchange_rate || 0)) / (selectedInvestmentData.exchange_rate || 1)) * 100).toFixed(2)}%
                      </span>
                    </div>
                    {/* Show remaining units if partial sale */}
                    {Number.parseFloat(unitsToSell) < totalCurrencyUnits && (
                      <>
                        <div className='pt-2 border-t border-current opacity-20' />
                        <div className='flex items-center justify-between text-sm bg-blue-100 dark:bg-blue-900 p-2 rounded'>
                          <span className='text-blue-700 dark:text-blue-300 font-medium'>
                            Unidades restantes:
                          </span>
                          <span className='font-bold text-blue-900 dark:text-blue-100'>
                            {(totalCurrencyUnits - Number.parseFloat(unitsToSell)).toLocaleString('es-AR', { minimumFractionDigits: 2 })} {selectedInvestmentData.currency}
                          </span>
                        </div>
                        <p className='text-xs text-blue-600 dark:text-blue-400 text-center'>
                          La inversión permanecerá activa con las unidades restantes
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Regular Investment Liquidation Form */}
        {selectedInvestment && !isCurrencyInvestment && selectedInvestmentData && (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='total-received'>Monto Total Recibido (ARS)</Label>
              <Input
                id='total-received'
                type='number'
                step='0.01'
                placeholder={`Ej: ${(selectedInvestmentData.amount + selectedInvestmentData.estimated_return).toFixed(2)}`}
                value={totalReceived}
                onChange={(e) => setTotalReceived(e.target.value)}
                required
              />
              <p className='text-xs text-gray-500'>
                Ingresa el monto total que recibiste (capital + intereses/ganancias)
              </p>
            </div>

            {totalReceived && Number.parseFloat(totalReceived) > 0 && (
              <Card className={`${regularReturn >= 0 ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                <CardContent className='pt-4'>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className={regularReturn >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                        Capital invertido:
                      </span>
                      <span className={`font-medium ${regularReturn >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                        ${selectedInvestmentData.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className={regularReturn >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                        Total recibido:
                      </span>
                      <span className={`font-medium ${regularReturn >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                        ${Number.parseFloat(totalReceived).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className='pt-2 border-t border-current opacity-20' />
                    <div className='flex items-center justify-between'>
                      <span className={`font-semibold ${regularReturn >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {regularReturn >= 0 ? 'Ganancia:' : 'Pérdida:'}
                      </span>
                      <span className={`font-bold text-xl ${regularReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {regularReturn >= 0 ? '+' : ''}${regularReturn.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {selectedInvestmentData.estimated_return > 0 && (
                      <div className='flex items-center justify-between text-xs'>
                        <span className={regularReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          vs Estimado:
                        </span>
                        <span className={`font-medium ${regularReturn >= selectedInvestmentData.estimated_return ? 'text-green-600' : 'text-amber-600'}`}>
                          {regularReturn >= selectedInvestmentData.estimated_return ? '+' : ''}
                          ${(regularReturn - selectedInvestmentData.estimated_return).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Button
          onClick={handleLiquidate}
          disabled={
            !selectedInvestment ||
            (isCurrencyInvestment
              ? (!unitsToSell || !sellExchangeRate || Number.parseFloat(unitsToSell) <= 0)
              : (!totalReceived || Number.parseFloat(totalReceived) <= 0)
            )
          }
          className='w-full bg-green-600 hover:bg-green-700'
        >
          <TrendingUp className='h-4 w-4 mr-2' />
          {isCurrencyInvestment && unitsToSell && Number.parseFloat(unitsToSell) < totalCurrencyUnits
            ? 'Vender Parcialmente y Crear Ingreso'
            : 'Liquidar Inversión y Crear Ingreso'
          }
        </Button>
      </div>
    </div>
  );
}
