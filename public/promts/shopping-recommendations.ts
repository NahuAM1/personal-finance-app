import type { NeedPrediction } from "@/lib/shopping-predictions";
import type { DataQuality } from "@/lib/shopping-stats";

interface PromptInput {
  predictions: NeedPrediction[];
  data_note: string;
  data_quality: DataQuality;
}

export const shoppingRecommendationsPrompt = (input: PromptInput): string => {
  const { predictions, data_note, data_quality } = input;

  const predictionsPayload = predictions.map((p) => ({
    product_key: p.product.name,
    display_name: p.product.display_name,
    category: p.product.category,
    purchases_90d: p.product.purchases_90d,
    last_purchase: p.product.last_purchase,
    days_since_last: p.product.days_since_last,
    avg_gap_days: p.product.avg_gap_days,
    expected_quantity: p.expected_quantity,
    expected_unit_price: p.expected_unit_price,
    estimated_total: p.estimated_total,
    urgency: p.urgency,
    days_until_expected: p.days_until_expected,
    confidence: p.confidence,
    rationale_key: p.rationale_key,
    ticket_ids: p.product.ticket_ids,
  }));

  return `Sos un asistente de compras para una app de finanzas personales en Argentina.

TU ROL EXCLUSIVO: escribir la \`reason\` (justificación en español) para CADA producto de una lista que el sistema YA seleccionó de forma determinística basándose en el historial real del usuario.

NO SOS quien decide la lista. NO agregues productos. NO elimines productos. NO cambies cantidades, precios ni niveles de confianza. Esos campos vienen LOCKED desde el sistema y deben pasar al output IDÉNTICOS.

CONTEXTO DE DATOS:
- Calidad: ${data_quality}
- Nota del sistema: ${data_note}

LISTA PRE-SELECCIONADA (decidida por el sistema, NO la modifiques):
${JSON.stringify(predictionsPayload, null, 2)}

INSTRUCCIONES:

1. Por CADA producto, escribí una \`reason\` específica y humana en español que cite las métricas concretas del producto. NO copies la \`rationale_key\` literal — convertila a lenguaje natural.

   Ejemplos buenos (basados en campos reales):
   - Si urgency="overdue" y days_until_expected=-15: "Hace 45 días que no lo comprás y tu ciclo es cada 30. Estás atrasado 15 días, te toca reponer seguro."
   - Si urgency="due_soon" y days_until_expected=5: "Comprás cada 25 días. Ya pasaron 20, te toca en 5."
   - Si urgency="experimental" (1 sola compra): "Compraste este producto una vez hace 60 días. No hay patrón claro todavía, pero es probable que ya se te haya acabado."
   - Si confidence="low": "... No estoy seguro de tu frecuencia, así que te lo sugiero con baja confianza."

   Ejemplos MALOS (rechazables):
   - "Es un producto esencial"
   - "Te conviene tener en casa"
   - "Podrías necesitarlo"
   - Frases genéricas sin números

CATEGORÍAS ACEPTADAS (la lista YA viene filtrada por el sistema, pero como red de seguridad, respetá estas):
- Despensa/Almacén (harina, fideos, arroz, lentejas, atún, tomate triturado, conservas)
- Limpieza (detergentes, lavandina, limpiadores, desengrasantes, papel de cocina)
- Higiene (papel higiénico, shampoo, jabón, desodorante, productos de cuidado personal)
- Condimentos (mayonesa, ketchup, mostaza, sal, pimienta, especias, caldos)
- Bebidas NO ALCOHÓLICAS (yerba, mate, té, café, leche en polvo)

EXCLUIDAS (no las recomiendo aunque el LLM tienda a incluirlas):
- Snacks/golosinas
- Bebidas alcohólicas (cerveza, vino, fernet, espumante)
- Carnes, Lácteos frescos, Panadería, Frutas y Verduras, Congelados
- Bazar no-consumible (utensilios, juguetes, vajilla, decoración)

2. \`product_name\`: COPIALO EXACTO del campo \`display_name\` de la lista. No lo reformatees, no lo corrijas, no lo abrevies.

3. \`suggested_quantity\`: COPIALO EXACTO de \`expected_quantity\`. No lo cambies.

4. \`estimated_price\`: COPIALO EXACTO de \`expected_unit_price\`. No lo cambies.

5. \`confidence\`: COPIALO EXACTO del campo \`confidence\` de la lista.

6. \`evidence_ticket_ids\`: usá los tickets de \`ticket_ids\` del producto. Si querés ser específico, elegí los 1-2 más recientes.

7. \`frequency\`: devolvé siempre "Mensual" (esta feature es solo de compra mensual).

8. Si la calidad es "scarce" y la lista es corta, está perfecto. No inventes productos para "completar".

9. \`insights\`: 2-3 oraciones sobre patrones observables en la lista (ej: "Veo que comprás limpieza cada 2 meses, te toca ahora", "Tu despensa muestra productos frescos del último mes").

10. \`data_note\`: nota honesta sobre los datos. Si la calidad es "good", podés ser más específico sobre el tamaño del dataset.

ESQUEMA DE SALIDA — JSON válido, sin markdown ni bloques de código:

{
  "recommendations": [
    {
      "product_name": "Display name EXACTO de la lista",
      "suggested_quantity": 1,
      "estimated_price": 100.00,
      "frequency": "Mensual",
      "reason": "Razón específica con métricas en español rioplatense",
      "evidence_ticket_ids": ["uuid"],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "insights": "Párrafo breve sobre patrones observados",
  "data_note": "Nota sobre los datos"
}`;
};
