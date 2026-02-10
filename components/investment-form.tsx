'use client';

import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { format, differenceInDays } from 'date-fns';
import type { Investment } from '@/types/database';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CryptoOption {
  instrumentId: number;
  name: string;
  displayName: string;
  iconUrl: string;
  price: number;
  aboveDollarPrecision: number;
}

interface InvestmentFormProps {
  onSubmit: (investment: Omit<Investment, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
}

const investmentTypes = [
  { value: 'plazo_fijo', label: 'Plazo Fijo' },
  { value: 'fci', label: 'FCI' },
  { value: 'bonos', label: 'Bonos' },
  { value: 'acciones', label: 'Acciones' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'letras', label: 'Letras' },
  { value: 'cedears', label: 'CEDEARs' },
  { value: 'cauciones', label: 'Cauciones' },
  { value: 'fondos_comunes_inversion', label: 'Fondos Comunes de Inversión' },
  { value: 'compra_divisas', label: 'Compra de Divisas' },
];

const currencies = [
  { value: 'USD', label: 'Dólar Estadounidense (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'BRL', label: 'Real Brasileño (BRL)' },
  { value: 'GBP', label: 'Libra Esterlina (GBP)' },
  { value: 'CHF', label: 'Franco Suizo (CHF)' },
  { value: 'JPY', label: 'Yen Japonés (JPY)' },
  { value: 'UYU', label: 'Peso Uruguayo (UYU)' },
  { value: 'CLP', label: 'Peso Chileno (CLP)' },
];

export function InvestmentForm({ onSubmit }: InvestmentFormProps) {
  const [description, setDescription] = useState('');
  const [investmentType, setInvestmentType] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [maturityDate, setMaturityDate] = useState('');
  const [annualRate, setAnnualRate] = useState('');
  const [currency, setCurrency] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [cryptoOptions, setCryptoOptions] = useState<CryptoOption[]>([]);
  const [selectedCrypto, setSelectedCrypto] = useState('');
  const [cryptoPriceUsd, setCryptoPriceUsd] = useState('');
  const [dolarCCL, setDolarCCL] = useState(0);
  const [loadingCrypto, setLoadingCrypto] = useState(false);
  const { toast } = useToast();

  const isCurrencyPurchase = investmentType === 'compra_divisas';
  const isCrypto = investmentType === 'crypto';

  useEffect(() => {
    if (!isCrypto) return;
    const fetchCryptoList = async () => {
      setLoadingCrypto(true);
      try {
        const [cryptoRes, dolarRes] = await Promise.all([
          fetch('/api/market?type=crypto'),
          fetch('/api/market?type=dolar'),
        ]);
        if (cryptoRes.ok) {
          const data = await cryptoRes.json();
          const popular: CryptoOption[] = (data.popular ?? []).map(
            (c: CryptoOption) => ({
              instrumentId: c.instrumentId,
              name: c.name,
              displayName: c.displayName,
              iconUrl: c.iconUrl,
              price: c.price,
              aboveDollarPrecision: c.aboveDollarPrecision,
            })
          );
          const trending: CryptoOption[] = (data.trending ?? []).map(
            (c: CryptoOption) => ({
              instrumentId: c.instrumentId,
              name: c.name,
              displayName: c.displayName,
              iconUrl: c.iconUrl,
              price: c.price,
              aboveDollarPrecision: c.aboveDollarPrecision,
            })
          );
          const seen = new Set<number>();
          const merged: CryptoOption[] = [];
          for (const item of [...popular, ...trending]) {
            if (!seen.has(item.instrumentId)) {
              seen.add(item.instrumentId);
              merged.push(item);
            }
          }
          setCryptoOptions(merged);
        }
        if (dolarRes.ok) {
          const dolarData = await dolarRes.json();
          interface DolarItem { casa: string; venta: number }
          const ccl = dolarData.find((d: DolarItem) => d.casa === 'contadoconliqui');
          if (ccl) setDolarCCL(ccl.venta);
        }
      } catch (error) {
        console.error('Error fetching crypto list:', error);
        toast({
          title: 'Error',
          description: 'No se pudo cargar la lista de criptomonedas',
          variant: 'destructive',
        });
      } finally {
        setLoadingCrypto(false);
      }
    };
    fetchCryptoList();
  }, [isCrypto]);

  const handleCryptoSelect = (cryptoName: string) => {
    setSelectedCrypto(cryptoName);
    const crypto = cryptoOptions.find((c) => c.name === cryptoName);
    if (crypto) {
      setCryptoPriceUsd(crypto.price.toString());
      setCurrency(crypto.name);
      if (dolarCCL > 0) {
        const priceArs = crypto.price * dolarCCL;
        setExchangeRate(priceArs.toFixed(2));
      }
    }
  };

  // Calculate estimated return
  const calculateEstimatedReturn = () => {
    if (!amount || !annualRate || !startDate || !maturityDate) return 0;

    const principal = Number.parseFloat(amount);
    const rate = Number.parseFloat(annualRate) / 100;
    const days = differenceInDays(new Date(maturityDate), new Date(startDate));

    if (days <= 0) return 0;

    // Simple interest calculation: I = P * r * (days/365)
    const estimatedReturn = principal * rate * (days / 365);
    return estimatedReturn;
  };

  const estimatedReturn = calculateEstimatedReturn();
  const totalReturn = estimatedReturn + (amount ? Number.parseFloat(amount) : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!description || !investmentType || !amount || !startDate) return;
    if (isCurrencyPurchase && (!currency || !exchangeRate)) return;
    if (isCrypto && (!selectedCrypto || !exchangeRate)) return;

    const investment: Omit<Investment, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
      description,
      investment_type: investmentType as Investment['investment_type'],
      amount: Number.parseFloat(amount),
      start_date: startDate,
      maturity_date: maturityDate || null,
      annual_rate: annualRate ? Number.parseFloat(annualRate) : null,
      estimated_return: estimatedReturn,
      is_liquidated: false,
      liquidation_date: null,
      actual_return: null,
      transaction_id: null,
      currency: (isCurrencyPurchase || isCrypto) && currency ? currency : null,
      exchange_rate: (isCurrencyPurchase || isCrypto) && exchangeRate ? Number.parseFloat(exchangeRate) : null,
    };

    onSubmit(investment);

    // Reset form
    setDescription('');
    setInvestmentType('');
    setAmount('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setMaturityDate('');
    setAnnualRate('');
    setCurrency('');
    setExchangeRate('');
    setSelectedCrypto('');
    setCryptoPriceUsd('');
  };

  return (
    <div className='space-y-6'>
      <Card className='bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'>
        <CardHeader>
          <CardTitle className='text-green-800 dark:text-green-200'>
            ¿Cómo funciona?
          </CardTitle>
          <CardDescription>
            Registra una inversión y el dinero quedará "congelado" hasta que la liquides.
            Al liquidar, se creará automáticamente un ingreso con el capital + ganancias.
          </CardDescription>
        </CardHeader>
      </Card>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='investment-description'>Descripción</Label>
          <Textarea
            id='investment-description'
            name='investment-description'
            placeholder='Ej: Plazo fijo Banco Galicia 28 días…'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            autoComplete='off'
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='investment-type'>Tipo de Inversión</Label>
          <Select value={investmentType} onValueChange={setInvestmentType} required>
            <SelectTrigger>
              <SelectValue placeholder='Selecciona el tipo' />
            </SelectTrigger>
            <SelectContent>
              {investmentTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCrypto && (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='crypto-select'>Criptomoneda</Label>
              {loadingCrypto ? (
                <div className='flex items-center gap-2 text-sm text-gray-500 py-2'>
                  <RefreshCw className='h-4 w-4 animate-spin' aria-hidden='true' />
                  Cargando criptomonedas...
                </div>
              ) : (
                <Select value={selectedCrypto} onValueChange={handleCryptoSelect} required>
                  <SelectTrigger>
                    <SelectValue placeholder='Selecciona una crypto' />
                  </SelectTrigger>
                  <SelectContent>
                    {cryptoOptions.map((crypto) => (
                      <SelectItem key={crypto.instrumentId} value={crypto.name}>
                        <div className='flex items-center gap-2'>
                          <img
                            src={crypto.iconUrl}
                            alt={crypto.displayName}
                            className='w-5 h-5 rounded-full'
                          />
                          <span>{crypto.name}</span>
                          <span className='text-gray-500'>- {crypto.displayName}</span>
                          <span className='text-xs text-gray-400 tabular-nums'>
                            US${'\u00A0'}{crypto.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedCrypto && (
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='crypto-price-usd'>Precio USD (referencia)</Label>
                  <Input
                    id='crypto-price-usd'
                    name='crypto-price-usd'
                    type='number'
                    inputMode='decimal'
                    step='0.01'
                    value={cryptoPriceUsd}
                    onChange={(e) => {
                      setCryptoPriceUsd(e.target.value);
                      if (e.target.value && dolarCCL > 0) {
                        setExchangeRate((Number.parseFloat(e.target.value) * dolarCCL).toFixed(2));
                      }
                    }}
                    min={0}
                    autoComplete='off'
                    className='tabular-nums'
                    readOnly
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='crypto-price-ars'>Precio en ARS (editable)</Label>
                  <Input
                    id='crypto-price-ars'
                    name='crypto-price-ars'
                    type='number'
                    inputMode='decimal'
                    step='0.01'
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    required
                    min={0}
                    autoComplete='off'
                    className='tabular-nums'
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isCurrencyPurchase && (
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='currency'>Divisa</Label>
              <Select value={currency} onValueChange={setCurrency} required>
                <SelectTrigger>
                  <SelectValue placeholder='Selecciona la divisa' />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.value} value={curr.value}>
                      {curr.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='exchange-rate'>Tipo de Cambio (ARS)</Label>
              <Input
                id='exchange-rate'
                name='exchange-rate'
                type='number'
                inputMode='decimal'
                step='0.01'
                placeholder='1050.00'
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                required
                min={0}
                autoComplete='off'
                className='tabular-nums'
              />
            </div>
          </div>
        )}

        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='investment-amount'>Monto a Invertir</Label>
            <Input
              id='investment-amount'
              name='investment-amount'
              type='number'
              inputMode='decimal'
              step='0.01'
              placeholder='0.00'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min={0}
              autoComplete='off'
              className='tabular-nums'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='annual-rate'>TNA % (opcional)</Label>
            <Input
              id='annual-rate'
              name='annual-rate'
              type='number'
              inputMode='decimal'
              step='0.01'
              placeholder='45.00'
              value={annualRate}
              onChange={(e) => setAnnualRate(e.target.value)}
              min={0}
              autoComplete='off'
              className='tabular-nums'
            />
          </div>
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='start-date'>Fecha de Inicio</Label>
            <Input
              id='start-date'
              type='date'
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='maturity-date'>Fecha de Vencimiento (opcional)</Label>
            <Input
              id='maturity-date'
              type='date'
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
            />
          </div>
        </div>

        {isCurrencyPurchase && amount && exchangeRate && Number.parseFloat(exchangeRate) > 0 && (
          <Card className='bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'>
            <CardContent className='pt-6'>
              <div className='space-y-3'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-emerald-700 dark:text-emerald-300'>Monto en ARS:</span>
                  <span className='font-semibold text-emerald-900 dark:text-emerald-100 tabular-nums'>
                    ${Number.parseFloat(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className='flex items-center justify-between text-sm'>
                  <span className='text-emerald-700 dark:text-emerald-300'>Tipo de cambio:</span>
                  <span className='font-semibold text-emerald-900 dark:text-emerald-100 tabular-nums'>
                    ${Number.parseFloat(exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className='pt-3 border-t border-emerald-200 dark:border-emerald-800'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-semibold text-emerald-700 dark:text-emerald-300'>
                      {currency ? `Unidades de ${currency}:` : 'Unidades de divisa:'}
                    </span>
                    <span className='text-xl font-bold text-emerald-900 dark:text-emerald-100 tabular-nums'>
                      {(Number.parseFloat(amount) / Number.parseFloat(exchangeRate)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isCrypto && selectedCrypto && amount && exchangeRate && Number.parseFloat(exchangeRate) > 0 && (
          <Card className='bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'>
            <CardContent className='pt-6'>
              <div className='space-y-3'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-orange-700 dark:text-orange-300'>Monto en ARS:</span>
                  <span className='font-semibold text-orange-900 dark:text-orange-100 tabular-nums'>
                    ${Number.parseFloat(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className='flex items-center justify-between text-sm'>
                  <span className='text-orange-700 dark:text-orange-300'>Precio por {selectedCrypto}:</span>
                  <span className='font-semibold text-orange-900 dark:text-orange-100 tabular-nums'>
                    ${Number.parseFloat(exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS
                  </span>
                </div>

                {dolarCCL > 0 && (
                  <div className='flex items-center justify-between text-sm'>
                    <span className='text-orange-700 dark:text-orange-300'>Dólar CCL usado:</span>
                    <span className='font-semibold text-orange-900 dark:text-orange-100 tabular-nums'>
                      ${dolarCCL.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className='pt-3 border-t border-orange-200 dark:border-orange-800'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-semibold text-orange-700 dark:text-orange-300'>
                      Unidades de {selectedCrypto}:
                    </span>
                    <span className='text-xl font-bold text-orange-900 dark:text-orange-100 tabular-nums'>
                      {(Number.parseFloat(amount) / Number.parseFloat(exchangeRate)).toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isCurrencyPurchase && !isCrypto && estimatedReturn > 0 && (
          <Card className='bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'>
            <CardContent className='pt-6'>
              <div className='space-y-3'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-blue-700 dark:text-blue-300'>Capital invertido:</span>
                  <span className='font-semibold text-blue-900 dark:text-blue-100 tabular-nums'>
                    ${Number.parseFloat(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className='flex items-center justify-between text-sm'>
                  <span className='text-blue-700 dark:text-blue-300'>Ganancia estimada:</span>
                  <span className='font-semibold text-green-600 dark:text-green-400 tabular-nums'>
                    +${estimatedReturn.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className='pt-3 border-t border-blue-200 dark:border-blue-800'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                      <TrendingUp className='h-4 w-4' aria-hidden="true" />
                      Total al vencimiento:
                    </span>
                    <span className='text-xl font-bold text-blue-900 dark:text-blue-100 tabular-nums'>
                      ${totalReturn.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {maturityDate && startDate && (
                  <div className='text-xs text-blue-600 dark:text-blue-400 text-center'>
                    Plazo: {differenceInDays(new Date(maturityDate), new Date(startDate))} días
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Button type='submit' className='w-full bg-green-600 hover:bg-green-700'>
          <TrendingUp className='h-4 w-4 mr-2' aria-hidden="true" />
          Registrar Inversión
        </Button>
      </form>
    </div>
  );
}
