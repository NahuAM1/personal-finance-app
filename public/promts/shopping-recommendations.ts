export const shoppingRecommendationsPrompt = (
  recentItems: string,
  lastYearItems: string,
) => `Eres un asistente de compras inteligente. Analiza el historial de compras del usuario y genera una lista de compras recomendada.

Compras recientes (últimos 10 tickets):
${recentItems}

Compras del mismo mes del año pasado:
${lastYearItems}

Genera una lista de compras recomendada en formato JSON. Responde SOLO con JSON válido, sin markdown:

{
  "recommendations": [
    {
      "product_name": "Nombre del producto",
      "suggested_quantity": 1,
      "estimated_price": 100.00,
      "frequency": "Semanal",
      "reason": "Razón breve de la recomendación"
    }
  ],
  "insights": "Un párrafo breve con insights sobre los patrones de compra del usuario"
}

Incluye entre 10 y 20 productos. Prioriza productos que el usuario compra frecuentemente. Estima precios basándote en los datos históricos.`;
