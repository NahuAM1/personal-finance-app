'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, ShoppingCart, Copy, Check, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Recommendation {
  product_name: string;
  suggested_quantity: number;
  estimated_price: number;
  frequency: string;
  reason: string;
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
  insights: string;
  message?: string;
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

  const copyList = () => {
    if (!data?.recommendations) return;

    const text = data.recommendations
      .map(
        (r) => `- ${r.product_name} x${r.suggested_quantity} (~$${r.estimated_price})`
      )
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    toast({
      title: 'Copiado',
      description: 'Lista de compras copiada al portapapeles',
    });
  };

  const estimatedTotal = useMemo(
    () => data?.recommendations?.reduce(
      (sum, r) => sum + r.estimated_price * r.suggested_quantity,
      0
    ) || 0,
    [data?.recommendations]
  );

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
            {/* Insights */}
            {data.insights && (
              <div className="flex gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <Lightbulb className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  {data.insights}
                </p>
              </div>
            )}

            {/* Recommended products */}
            <div className="space-y-2">
              {data.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg border border-purple-100 dark:border-purple-800"
                >
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                      {rec.product_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span>x{rec.suggested_quantity}</span>
                      <Badge variant="outline" className="text-xs py-0 px-1.5">
                        {rec.frequency}
                      </Badge>
                      <span className="hidden sm:inline text-gray-400">{rec.reason}</span>
                    </div>
                  </div>
                  <span className="font-semibold text-sm text-purple-700 dark:text-purple-300 tabular-nums">
                    ~${rec.estimated_price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
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
