'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, ShoppingCart, Copy, Check, Lightbulb, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Confidence = 'high' | 'medium' | 'low';

interface Recommendation {
  product_name: string;
  suggested_quantity: number;
  estimated_price: number;
  frequency: string;
  reason: string;
  confidence?: Confidence;
  urgency?: 'overdue' | 'due_soon' | 'scheduled' | 'experimental';
  days_until_expected?: number | null;
  category: string;
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
  insights: string;
  data_note?: string;
  message?: string;
  total_estimated?: number;
}

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700',
  medium: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700',
  low: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-600',
};

const URGENCY_LABELS: Record<NonNullable<Recommendation['urgency']>, string> = {
  overdue: 'Vencido',
  due_soon: 'Pronto',
  scheduled: 'Programado',
  experimental: 'Experimental',
};

const URGENCY_STYLES: Record<NonNullable<Recommendation['urgency']>, string> = {
  overdue: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700',
  due_soon: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700',
  scheduled: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700',
  experimental: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-600',
};

function formatDaysUntil(days: number | null | undefined): string | null {
  if (days === null || days === undefined) return null;
  if (days < 0) return `${Math.abs(days)}d atrasado`;
  if (days === 0) return 'hoy';
  return `en ${days}d`;
}

export function ShoppingRecommendations() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateRecommendations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/smartpocket/shopping-recommendations', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al generar recomendaciones');
      }

      const result = await response.json();
      setData(result);

      if (result.message) {
        toast({
          title: 'Información',
          description: result.message,
          variant: 'info',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudieron generar recomendaciones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const estimatedTotal = useMemo(
    () => data?.recommendations?.reduce(
      (sum, r) => sum + r.estimated_price * r.suggested_quantity,
      0
    ) || 0,
    [data?.recommendations]
  );

  const groupedByCategory = useMemo(() => {
    const groups: Map<string, Recommendation[]> = new Map();
    if (!data?.recommendations) return groups;

    for (const rec of data.recommendations) {
      const category: string = rec.category;
      const existing: Recommendation[] | undefined = groups.get(category);
      if (existing !== undefined) {
        existing.push(rec);
      } else {
        groups.set(category, [rec]);
      }
    }
    return groups;
  }, [data?.recommendations]);

  const copyList = () => {
    if (!data?.recommendations) return;

    const lines: string[] = [];
    groupedByCategory.forEach((recs, category) => {
      lines.push(category);
      recs.forEach((r) => {
        lines.push(`- ${r.product_name} x${r.suggested_quantity}`);
      });
      lines.push('');
    });

    const text = lines.join('\n').trimEnd();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    toast({
      title: 'Copiado',
      description: 'Lista de compras copiada al portapapeles',
    });
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" aria-hidden="true" />
              Lista de Compras IA
            </CardTitle>
            <CardDescription>
              Genera una lista de compras inteligente basada en tu historial
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {data?.recommendations && data.recommendations.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyList}
                aria-label="Copiar lista de compras"
                className="border-purple-200"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-1 text-green-600" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" aria-hidden="true" />
                )}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            )}
            <Button
              onClick={generateRecommendations}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Generar lista
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-purple-300" aria-hidden="true" />
            <p>Presiona &ldquo;Generar lista&rdquo; para crear tu lista de compras inteligente</p>
          </div>
        ) : data.recommendations?.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>{data.message || 'No hay suficientes datos para generar recomendaciones.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Data note */}
            {data.data_note && (
              <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-800 dark:text-blue-200">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p>{data.data_note}</p>
              </div>
            )}

            {/* Insights */}
            {data.insights && (
              <div className="flex gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <Lightbulb className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  {data.insights}
                </p>
              </div>
            )}

            {/* Recommended products, grouped by category */}
            <div className="space-y-4">
              {Array.from(groupedByCategory.entries()).map(([category, recs], groupIndex) => (
                <div key={category} className="space-y-2">
                  <div className={`flex items-center gap-4 ${groupIndex === 0 ? '' : 'pt-2'}`}>
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <h3 className="font-semibold text-gray-700 px-4 py-2 bg-gray-50 rounded-lg text-sm">
                      {category}
                    </h3>
                    <div className="h-px bg-gray-200 flex-1"></div>
                  </div>
                  <div className="space-y-2">
                    {recs.map((rec, index) => {
                      const confidence: Confidence = rec.confidence ?? 'low';
                      const urgency: Recommendation['urgency'] = rec.urgency;
                      const daysLabel: string | null = formatDaysUntil(rec.days_until_expected);

                      return (
                        <div
                          key={`${category}-${index}`}
                          className="flex items-start gap-3 p-3 rounded-lg border border-purple-100 dark:border-purple-800"
                        >
                          <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300 flex-shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-white">
                              {rec.product_name}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-xs text-gray-500">x{rec.suggested_quantity}</span>
                              <Badge variant="outline" className="text-xs py-0 px-1.5 border-purple-200 text-purple-700 dark:border-purple-700 dark:text-purple-300">
                                {rec.frequency}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs py-0 px-1.5 ${CONFIDENCE_STYLES[confidence]}`}
                              >
                                Confianza: {CONFIDENCE_LABELS[confidence]}
                              </Badge>
                              {urgency !== undefined && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs py-0 px-1.5 ${URGENCY_STYLES[urgency]}`}
                                >
                                  {URGENCY_LABELS[urgency]}
                                  {daysLabel !== null && ` (${daysLabel})`}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                              {rec.reason}
                            </p>
                          </div>
                          <span className="font-semibold text-sm text-purple-700 dark:text-purple-300 tabular-nums flex-shrink-0">
                            ~${rec.estimated_price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Estimated total */}
            <div className="flex items-center justify-between p-4 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <span className="font-medium text-purple-800 dark:text-purple-200">
                Total estimado
              </span>
              <span className="text-xl font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                ~${estimatedTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
