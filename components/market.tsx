'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DolarData {
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

interface CedearData {
  ticker: string;
  price_ars?: number;
  change_ars?: number;
  price_usd?: number;
  change_usd?: number;
  ratio?: number;
}

interface BonoData {
  ticker: string;
  name?: string;
  price_ars?: number;
  change_ars?: number;
  price_usd?: number;
  change_usd?: number;
  ratio?: number;
}

interface AccionData {
  ticker: string;
  price_ars: number;
  change_ars: number;
  price_usd?: number;
  change_usd?: number;
}

interface RawStockData {
  symbol: string;
  c: number;
  pct_change: number;
}

interface CryptoItem {
  instrumentId: number;
  name: string;
  displayName: string;
  iconUrl: string;
  slug: string;
  price: number;
  precision: number;
  aboveDollarPrecision: number;
  deltaPercent: number;
  sellCurrencyId: number;
}

interface CryptoMarketData {
  priceData: {
    price: number;
    officialClosingPrice: number;
    delta: number;
    deltaPercent: number;
  };
  priceHistory: {
    priceDeltas: Record<string, { delta: number; deltaPercent: number }>;
  };
  financialData: {
    cryptoMarketCapitalization: number;
    cryptoVolume24Hours: number;
  };
}

interface CryptoResponse {
  instrumentId: number;
  displayName: string;
  name: string;
  iconUrl: string;
  marketData: CryptoMarketData;
  popular: CryptoItem[];
  trending: CryptoItem[];
  dailyRaisers: CryptoItem[];
  dailyFallers: CryptoItem[];
}

export function Market() {
  const [activeTab, setActiveTab] = useState('dolar');
  const [dolarData, setDolarData] = useState<DolarData[]>([]);
  const [cedearData, setCedearData] = useState<CedearData[]>([]);
  const [bonoData, setBonoData] = useState<BonoData[]>([]);
  const [accionData, setAccionData] = useState<AccionData[]>([]);
  const [cryptoData, setCryptoData] = useState<CryptoResponse | null>(null);
  const [selectedCryptoDetail, setSelectedCryptoDetail] = useState<CryptoResponse | null>(null);
  const [loadingCryptoDetail, setLoadingCryptoDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dolarCCL, setDolarCCL] = useState<number>(1500);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  const fetchData = async (type: string) => {
    setLoading(true);
    try {
      console.log(`Fetching ${type} data...`);

      let dolarCCLValue = dolarCCL;
      if (type === 'cedears' || type === 'bonos') {
        try {
          const dolarResponse = await fetch('/api/market?type=dolar');
          if (dolarResponse.ok) {
            const dolarData = await dolarResponse.json();
            const ccl = dolarData.find((d: DolarData) => d.casa === 'contadoconliqui');
            if (ccl) {
              dolarCCLValue = ccl.venta;
              setDolarCCL(dolarCCLValue);
              console.log(`Using dolar CCL: ${dolarCCLValue}`);
            }
          }
        } catch (error) {
          console.error('Error fetching dolar CCL:', error);
        }
      }

      const response = await fetch(`/api/market?type=${type}`);
      console.log(`Response status:`, response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Error fetching data');
      }

      const data = await response.json();
      console.log(`Data received for ${type}:`, data);

      if (Array.isArray(data) && data.length > 0) {
        console.log(`First ${type} item structure:`, data[0]);
        console.log(`${type} property keys:`, Object.keys(data[0]));
      }

      switch (type) {
        case 'dolar':
          setDolarData(Array.isArray(data) ? data : []);
          break;
        case 'cedears':
          const mappedCedears = Array.isArray(data) ? data.map((item: Record<string, number | string>) => ({
            ticker: item.symbol as string,
            price_ars: item.c as number,
            change_ars: item.pct_change as number,
            price_usd: undefined,
            change_usd: undefined,
            ratio: undefined,
          })) : [];
          console.log(`Mapped ${mappedCedears.length} CEDEARs. First item:`, mappedCedears[0]);
          setCedearData(mappedCedears);
          break;
        case 'bonos':
          const mappedBonos = Array.isArray(data) ? data.map((item: Record<string, number | string>) => ({
            ticker: item.symbol as string,
            name: item.name as string,
            price_ars: item.c as number,
            change_ars: item.pct_change as number,
            price_usd: undefined,
            change_usd: undefined,
            ratio: undefined,
          })) : [];
          console.log(`Mapped ${mappedBonos.length} Bonos. First item:`, mappedBonos[0]);
          setBonoData(mappedBonos);
          break;
        case 'acciones':
          const rawStocks: RawStockData[] = Array.isArray(data) ? data : [];
          const allSymbols = new Set(rawStocks.map(s => s.symbol));
          const stockMap = new Map<string, AccionData>();

          for (const stock of rawStocks) {
            const symbol = stock.symbol;

            if (symbol.includes('.')) continue;

            if (symbol.endsWith('D')) {
              const baseSymbol = symbol.slice(0, -1);
              if (allSymbols.has(baseSymbol)) continue;

              stockMap.set(symbol, {
                ticker: symbol,
                price_ars: 0,
                change_ars: 0,
                price_usd: stock.c,
                change_usd: stock.pct_change,
              });
              continue;
            }

            stockMap.set(symbol, {
              ticker: symbol,
              price_ars: stock.c,
              change_ars: stock.pct_change,
              price_usd: undefined,
              change_usd: undefined,
            });
          }

          for (const stock of rawStocks) {
            const symbol = stock.symbol;
            if (symbol.endsWith('D') && !symbol.includes('.')) {
              const baseSymbol = symbol.slice(0, -1);
              const existingStock = stockMap.get(baseSymbol);
              if (existingStock) {
                existingStock.price_usd = stock.c;
                existingStock.change_usd = stock.pct_change;
              }
            }
            if (symbol.includes('.D')) {
              const baseSymbol = symbol.replace('.D', '');
              const existingStock = stockMap.get(baseSymbol);
              if (existingStock) {
                existingStock.price_usd = stock.c;
                existingStock.change_usd = stock.pct_change;
              }
            }
          }

          const mappedAcciones = Array.from(stockMap.values())
            .sort((a, b) => a.ticker.localeCompare(b.ticker));
          console.log(`Mapped ${mappedAcciones.length} Acciones. First item:`, mappedAcciones[0]);
          setAccionData(mappedAcciones);
          break;
        case 'crypto':
          setCryptoData(data as CryptoResponse);
          setSelectedCryptoDetail(data as CryptoResponse);
          break;
      }

      console.log(`Successfully loaded ${type} data`);
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      toast({
        title: 'Error',
        description: `No se pudo obtener la información de ${type}: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab) {
      fetchData(activeTab);
    }
  }, [activeTab]);

  const fetchCryptoDetail = async (instrumentId: number) => {
    setLoadingCryptoDetail(true);
    try {
      const response = await fetch(`/api/market?type=crypto&instrumentId=${instrumentId}`);
      if (!response.ok) throw new Error('Error fetching crypto detail');
      const data = await response.json();
      setSelectedCryptoDetail(data as CryptoResponse);
    } catch (error) {
      console.error('Error fetching crypto detail:', error);
      toast({
        title: 'Error',
        description: 'No se pudo obtener el detalle de la crypto',
        variant: 'destructive',
      });
    } finally {
      setLoadingCryptoDetail(false);
    }
  };

  const filterData = <T extends { ticker?: string; nombre?: string; name?: string }>(
    data: T[]
  ) => {
    if (!searchTerm) return data;
    return data.filter((item) => {
      const searchString =
        item.ticker?.toLowerCase() ||
        item.nombre?.toLowerCase() ||
        item.name?.toLowerCase() ||
        '';
      return searchString.includes(searchTerm.toLowerCase());
    });
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <DollarSign className='h-5 w-5' />
                Mercado en Tiempo Real
              </CardTitle>
              <CardDescription>
                Información actualizada del mercado financiero argentino
              </CardDescription>
            </div>
            <Button
              onClick={() => fetchData(activeTab)}
              variant='outline'
              size='sm'
              disabled={loading}
              aria-label='Actualizar datos del mercado'
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className='grid w-full grid-cols-3 md:grid-cols-5 h-auto'>
              <TabsTrigger value='dolar'>Dólar</TabsTrigger>
              <TabsTrigger value='cedears'>CEDEARs</TabsTrigger>
              <TabsTrigger value='bonos'>Bonos</TabsTrigger>
              <TabsTrigger value='acciones'>Acciones</TabsTrigger>
              <TabsTrigger value='crypto'>Crypto</TabsTrigger>
            </TabsList>

            <TabsContent value='dolar' className='space-y-4'>
              <div className='space-y-3'>
                {dolarData.map((dolar) => (
                  <div
                    key={dolar.casa}
                    className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg'
                  >
                    <div className='font-semibold text-lg'>{dolar.nombre}</div>
                    <div className='flex gap-8 items-center'>
                      <div className='text-right'>
                        <div className='text-xs text-gray-500 mb-1'>Compra</div>
                        <div className='text-lg font-semibold text-green-600 tabular-nums'>
                          ${'\u00A0'}{dolar.compra.toLocaleString()}
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='text-xs text-gray-500 mb-1'>Venta</div>
                        <div className='text-lg font-semibold text-red-600 tabular-nums'>
                          ${'\u00A0'}{dolar.venta.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value='cedears' className='space-y-4'>
              <div className='mb-4'>
                <label htmlFor='search-cedears' className='sr-only'>Buscar CEDEARs</label>
                <input
                  id='search-cedears'
                  name='search-cedears'
                  type='search'
                  placeholder='Buscar por ticker…'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  autoComplete='off'
                  spellCheck={false}
                />
              </div>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b border-gray-200 dark:border-gray-700'>
                      <th className='text-left py-3 px-4'>Ticker</th>
                      <th className='text-right py-3 px-4'>Precio ARS</th>
                      <th className='text-right py-3 px-4'>Cambio %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(cedearData).slice(0, 20).map((cedear) => (
                      <tr
                        key={cedear.ticker}
                        className='border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                      >
                        <td className='py-3 px-4 font-semibold'>
                          {cedear.ticker}
                        </td>
                        <td className='py-3 px-4 text-right font-medium tabular-nums'>
                          ${'\u00A0'}{cedear.price_ars?.toLocaleString() || '-'}
                        </td>
                        <td className='py-3 px-4 text-right tabular-nums'>
                          {cedear.change_ars !== undefined ? (
                            <span
                              className={`flex items-center justify-end gap-1 font-semibold ${
                                cedear.change_ars >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {cedear.change_ars >= 0 ? (
                                <TrendingUp className='h-3 w-3' aria-hidden="true" />
                              ) : (
                                <TrendingDown className='h-3 w-3' aria-hidden="true" />
                              )}
                              {cedear.change_ars.toFixed(2)}%
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value='bonos' className='space-y-4'>
              <div className='mb-4'>
                <label htmlFor='search-bonos' className='sr-only'>Buscar Bonos</label>
                <input
                  id='search-bonos'
                  name='search-bonos'
                  type='search'
                  placeholder='Buscar por ticker…'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  autoComplete='off'
                  spellCheck={false}
                />
              </div>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b border-gray-200 dark:border-gray-700'>
                      <th className='text-left py-3 px-4'>Ticker</th>
                      <th className='text-right py-3 px-4'>Precio ARS</th>
                      <th className='text-right py-3 px-4'>Cambio %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(bonoData).map((bono) => (
                      <tr
                        key={bono.ticker}
                        className='border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                      >
                        <td className='py-3 px-4 font-semibold'>
                          {bono.ticker}
                        </td>
                        <td className='py-3 px-4 text-right font-medium tabular-nums'>
                          ${'\u00A0'}{bono.price_ars?.toLocaleString() || '-'}
                        </td>
                        <td className='py-3 px-4 text-right tabular-nums'>
                          {bono.change_ars !== undefined ? (
                            <span
                              className={`flex items-center justify-end gap-1 font-semibold ${
                                bono.change_ars >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {bono.change_ars >= 0 ? (
                                <TrendingUp className='h-3 w-3' aria-hidden="true" />
                              ) : (
                                <TrendingDown className='h-3 w-3' aria-hidden="true" />
                              )}
                              {bono.change_ars.toFixed(2)}%
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value='acciones' className='space-y-4'>
              <div className='mb-4'>
                <label htmlFor='search-acciones' className='sr-only'>Buscar Acciones</label>
                <input
                  id='search-acciones'
                  name='search-acciones'
                  type='search'
                  placeholder='Buscar por ticker…'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  autoComplete='off'
                  spellCheck={false}
                />
              </div>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b border-gray-200 dark:border-gray-700'>
                      <th
                        className='text-left py-3 px-4 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800'
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      >
                        <span className='flex items-center gap-1'>
                          Ticker
                          <span className='text-xs'>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        </span>
                      </th>
                      <th className='text-right py-3 px-4'>Precio ARS</th>
                      <th className='text-right py-3 px-4'>Cambio ARS</th>
                      <th className='text-right py-3 px-4'>$ Precio USD</th>
                      <th className='text-right py-3 px-4'>$ Cambio USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterData(accionData)
                      .sort((a, b) => sortOrder === 'asc'
                        ? a.ticker.localeCompare(b.ticker)
                        : b.ticker.localeCompare(a.ticker))
                      .map((accion) => (
                      <tr
                        key={accion.ticker}
                        className='border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                      >
                        <td className='py-3 px-4 font-semibold'>
                          {accion.ticker}
                        </td>
                        <td className='py-3 px-4 text-right font-medium tabular-nums'>
                          {accion.price_ars > 0
                            ? `$${'\u00A0'}${accion.price_ars.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>
                        <td className='py-3 px-4 text-right tabular-nums'>
                          {accion.price_ars > 0 ? (
                            <span
                              className={`flex items-center justify-end gap-1 font-semibold ${
                                accion.change_ars >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {accion.change_ars >= 0 ? (
                                <TrendingUp className='h-3 w-3' aria-hidden="true" />
                              ) : (
                                <TrendingDown className='h-3 w-3' aria-hidden="true" />
                              )}
                              {accion.change_ars.toFixed(2)}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className='py-3 px-4 text-right font-medium tabular-nums'>
                          {accion.price_usd !== undefined
                            ? `US$${'\u00A0'}${accion.price_usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>
                        <td className='py-3 px-4 text-right tabular-nums'>
                          {accion.change_usd !== undefined ? (
                            <span
                              className={`flex items-center justify-end gap-1 font-semibold ${
                                accion.change_usd >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {accion.change_usd >= 0 ? (
                                <TrendingUp className='h-3 w-3' aria-hidden="true" />
                              ) : (
                                <TrendingDown className='h-3 w-3' aria-hidden="true" />
                              )}
                              {accion.change_usd.toFixed(2)}%
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value='crypto' className='space-y-4'>
              {cryptoData && (
                <>
                  {/* Dynamic Hero Card */}
                  {selectedCryptoDetail && (
                    <div className={`p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/30 dark:to-yellow-950/30 rounded-lg border border-orange-200 dark:border-orange-800 transition-opacity ${loadingCryptoDetail ? 'opacity-50' : ''}`}>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                          <img
                            src={selectedCryptoDetail.iconUrl}
                            alt={selectedCryptoDetail.displayName}
                            className='w-10 h-10 rounded-full'
                          />
                          <div>
                            <div className='font-bold text-lg'>{selectedCryptoDetail.displayName}</div>
                            <div className='text-sm text-gray-500'>{selectedCryptoDetail.name}</div>
                          </div>
                          {loadingCryptoDetail && (
                            <RefreshCw className='h-4 w-4 animate-spin text-gray-400' aria-hidden='true' />
                          )}
                        </div>
                        <div className='text-right'>
                          <div className='text-2xl font-bold tabular-nums'>
                            US${'\u00A0'}{selectedCryptoDetail.marketData.priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <span
                            className={`flex items-center justify-end gap-1 font-semibold ${
                              selectedCryptoDetail.marketData.priceData.deltaPercent >= 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}
                          >
                            {selectedCryptoDetail.marketData.priceData.deltaPercent >= 0 ? (
                              <TrendingUp className='h-3 w-3' aria-hidden='true' />
                            ) : (
                              <TrendingDown className='h-3 w-3' aria-hidden='true' />
                            )}
                            {selectedCryptoDetail.marketData.priceData.deltaPercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className='grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm'>
                        {selectedCryptoDetail.marketData.priceHistory.priceDeltas.OneWeek && (
                          <div className='bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center'>
                            <div className='text-xs text-gray-500'>7 días</div>
                            <div className={`font-semibold ${selectedCryptoDetail.marketData.priceHistory.priceDeltas.OneWeek.deltaPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {selectedCryptoDetail.marketData.priceHistory.priceDeltas.OneWeek.deltaPercent.toFixed(2)}%
                            </div>
                          </div>
                        )}
                        {selectedCryptoDetail.marketData.priceHistory.priceDeltas.OneMonth && (
                          <div className='bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center'>
                            <div className='text-xs text-gray-500'>30 días</div>
                            <div className={`font-semibold ${selectedCryptoDetail.marketData.priceHistory.priceDeltas.OneMonth.deltaPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {selectedCryptoDetail.marketData.priceHistory.priceDeltas.OneMonth.deltaPercent.toFixed(2)}%
                            </div>
                          </div>
                        )}
                        {selectedCryptoDetail.marketData.priceHistory.priceDeltas.SixMonths && (
                          <div className='bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center'>
                            <div className='text-xs text-gray-500'>6 meses</div>
                            <div className={`font-semibold ${selectedCryptoDetail.marketData.priceHistory.priceDeltas.SixMonths.deltaPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {selectedCryptoDetail.marketData.priceHistory.priceDeltas.SixMonths.deltaPercent.toFixed(2)}%
                            </div>
                          </div>
                        )}
                        {selectedCryptoDetail.marketData.priceHistory.priceDeltas.OneYear && (
                          <div className='bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center'>
                            <div className='text-xs text-gray-500'>1 año</div>
                            <div className={`font-semibold ${selectedCryptoDetail.marketData.priceHistory.priceDeltas.OneYear.deltaPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {selectedCryptoDetail.marketData.priceHistory.priceDeltas.OneYear.deltaPercent.toFixed(2)}%
                            </div>
                          </div>
                        )}
                      </div>
                      <div className='grid grid-cols-2 gap-3 mt-3 text-sm'>
                        <div className='bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center'>
                          <div className='text-xs text-gray-500'>Market Cap</div>
                          <div className='font-semibold'>
                            US${'\u00A0'}{(selectedCryptoDetail.marketData.financialData.cryptoMarketCapitalization / 1e9).toFixed(1)}B
                          </div>
                        </div>
                        <div className='bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center'>
                          <div className='text-xs text-gray-500'>Volumen 24h</div>
                          <div className='font-semibold'>
                            US${'\u00A0'}{(selectedCryptoDetail.marketData.financialData.cryptoVolume24Hours / 1e9).toFixed(1)}B
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Popular Cryptos */}
                  <div>
                    <h3 className='font-semibold text-sm text-gray-500 mb-3 flex items-center gap-1'>
                      <Star className='h-4 w-4' aria-hidden='true' />
                      Populares
                    </h3>
                    <div className='overflow-x-auto'>
                      <table className='w-full text-sm'>
                        <thead>
                          <tr className='border-b border-gray-200 dark:border-gray-700'>
                            <th className='text-left py-3 px-4'>Crypto</th>
                            <th className='text-right py-3 px-4'>Precio USD</th>
                            <th className='text-right py-3 px-4'>Cambio %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cryptoData.popular.map((crypto) => (
                            <tr
                              key={crypto.instrumentId}
                              className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                                selectedCryptoDetail?.instrumentId === crypto.instrumentId ? 'bg-orange-50 dark:bg-orange-950/20' : ''
                              }`}
                              onClick={() => fetchCryptoDetail(crypto.instrumentId)}
                            >
                              <td className='py-3 px-4'>
                                <div className='flex items-center gap-2'>
                                  <img
                                    src={crypto.iconUrl}
                                    alt={crypto.displayName}
                                    className='w-6 h-6 rounded-full'
                                  />
                                  <div>
                                    <div className='font-semibold'>{crypto.name}</div>
                                    <div className='text-xs text-gray-500'>{crypto.displayName}</div>
                                  </div>
                                </div>
                              </td>
                              <td className='py-3 px-4 text-right font-medium tabular-nums'>
                                US${'\u00A0'}{crypto.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: crypto.aboveDollarPrecision })}
                              </td>
                              <td className='py-3 px-4 text-right tabular-nums'>
                                <span
                                  className={`flex items-center justify-end gap-1 font-semibold ${
                                    crypto.deltaPercent >= 0
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {crypto.deltaPercent >= 0 ? (
                                    <TrendingUp className='h-3 w-3' aria-hidden='true' />
                                  ) : (
                                    <TrendingDown className='h-3 w-3' aria-hidden='true' />
                                  )}
                                  {crypto.deltaPercent.toFixed(2)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Trending */}
                  {cryptoData.trending.length > 0 && (
                    <div>
                      <h3 className='font-semibold text-sm text-gray-500 mb-3 flex items-center gap-1'>
                        <TrendingUp className='h-4 w-4' aria-hidden='true' />
                        Tendencias
                      </h3>
                      <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                          <thead>
                            <tr className='border-b border-gray-200 dark:border-gray-700'>
                              <th className='text-left py-3 px-4'>Crypto</th>
                              <th className='text-right py-3 px-4'>Precio USD</th>
                              <th className='text-right py-3 px-4'>Cambio %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cryptoData.trending.map((crypto) => (
                              <tr
                                key={crypto.instrumentId}
                                className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                                  selectedCryptoDetail?.instrumentId === crypto.instrumentId ? 'bg-orange-50 dark:bg-orange-950/20' : ''
                                }`}
                                onClick={() => fetchCryptoDetail(crypto.instrumentId)}
                              >
                                <td className='py-3 px-4'>
                                  <div className='flex items-center gap-2'>
                                    <img
                                      src={crypto.iconUrl}
                                      alt={crypto.displayName}
                                      className='w-6 h-6 rounded-full'
                                    />
                                    <div>
                                      <div className='font-semibold'>{crypto.name}</div>
                                      <div className='text-xs text-gray-500'>{crypto.displayName}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className='py-3 px-4 text-right font-medium tabular-nums'>
                                  US${'\u00A0'}{crypto.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: crypto.aboveDollarPrecision })}
                                </td>
                                <td className='py-3 px-4 text-right tabular-nums'>
                                  <span
                                    className={`flex items-center justify-end gap-1 font-semibold ${
                                      crypto.deltaPercent >= 0
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }`}
                                  >
                                    {crypto.deltaPercent >= 0 ? (
                                      <TrendingUp className='h-3 w-3' aria-hidden='true' />
                                    ) : (
                                      <TrendingDown className='h-3 w-3' aria-hidden='true' />
                                    )}
                                    {crypto.deltaPercent.toFixed(2)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Daily Raisers & Fallers */}
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {cryptoData.dailyRaisers.length > 0 && (
                      <div>
                        <h3 className='font-semibold text-sm text-green-600 mb-3 flex items-center gap-1'>
                          <TrendingUp className='h-4 w-4' aria-hidden='true' />
                          Mayores subas del día
                        </h3>
                        <div className='space-y-2'>
                          {cryptoData.dailyRaisers.map((crypto) => (
                            <div
                              key={crypto.instrumentId}
                              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                                selectedCryptoDetail?.instrumentId === crypto.instrumentId
                                  ? 'bg-orange-50 dark:bg-orange-950/20 ring-1 ring-orange-300'
                                  : 'bg-green-50 dark:bg-green-950/20'
                              }`}
                              onClick={() => fetchCryptoDetail(crypto.instrumentId)}
                            >
                              <div className='flex items-center gap-2'>
                                <img
                                  src={crypto.iconUrl}
                                  alt={crypto.displayName}
                                  className='w-6 h-6 rounded-full'
                                />
                                <div>
                                  <div className='font-semibold text-sm'>{crypto.name}</div>
                                  <div className='text-xs text-gray-500'>{crypto.displayName}</div>
                                </div>
                              </div>
                              <div className='text-right'>
                                <div className='text-sm font-medium tabular-nums'>
                                  US${'\u00A0'}{crypto.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: crypto.aboveDollarPrecision })}
                                </div>
                                <Badge variant='outline' className='text-green-600 border-green-300'>
                                  +{crypto.deltaPercent.toFixed(2)}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cryptoData.dailyFallers.length > 0 && (
                      <div>
                        <h3 className='font-semibold text-sm text-red-600 mb-3 flex items-center gap-1'>
                          <TrendingDown className='h-4 w-4' aria-hidden='true' />
                          Mayores bajas del día
                        </h3>
                        <div className='space-y-2'>
                          {cryptoData.dailyFallers.map((crypto) => (
                            <div
                              key={crypto.instrumentId}
                              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                                selectedCryptoDetail?.instrumentId === crypto.instrumentId
                                  ? 'bg-orange-50 dark:bg-orange-950/20 ring-1 ring-orange-300'
                                  : 'bg-red-50 dark:bg-red-950/20'
                              }`}
                              onClick={() => fetchCryptoDetail(crypto.instrumentId)}
                            >
                              <div className='flex items-center gap-2'>
                                <img
                                  src={crypto.iconUrl}
                                  alt={crypto.displayName}
                                  className='w-6 h-6 rounded-full'
                                />
                                <div>
                                  <div className='font-semibold text-sm'>{crypto.name}</div>
                                  <div className='text-xs text-gray-500'>{crypto.displayName}</div>
                                </div>
                              </div>
                              <div className='text-right'>
                                <div className='text-sm font-medium tabular-nums'>
                                  US${'\u00A0'}{crypto.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: crypto.aboveDollarPrecision })}
                                </div>
                                <Badge variant='outline' className='text-red-600 border-red-300'>
                                  {crypto.deltaPercent.toFixed(2)}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
