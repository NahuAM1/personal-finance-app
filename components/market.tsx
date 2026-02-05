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

export function Market() {
  const [activeTab, setActiveTab] = useState('dolar');
  const [dolarData, setDolarData] = useState<DolarData[]>([]);
  const [cedearData, setCedearData] = useState<CedearData[]>([]);
  const [bonoData, setBonoData] = useState<BonoData[]>([]);
  const [accionData, setAccionData] = useState<AccionData[]>([]);
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
            <TabsList className='grid w-full grid-cols-4'>
              <TabsTrigger value='dolar'>Dólar</TabsTrigger>
              <TabsTrigger value='cedears'>CEDEARs</TabsTrigger>
              <TabsTrigger value='bonos'>Bonos</TabsTrigger>
              <TabsTrigger value='acciones'>Acciones</TabsTrigger>
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
