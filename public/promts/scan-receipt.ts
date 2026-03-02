import { ticketItemCategories, formatCategories } from '@/public/constants';

export const scanReceiptPrompt = `Eres un experto en OCR de tickets de compra. Analiza la imagen del ticket y extrae la información en formato JSON estricto.

Responde SOLO con un JSON válido, sin markdown ni texto adicional:

{
  "store_name": "Nombre de la tienda/supermercado",
  "ticket_date": "YYYY-MM-DD",
  "items": [
    {
      "product_name": "Nombre del producto",
      "quantity": 1,
      "unit_price": 100.00,
      "total_price": 100.00,
      "category": "Categoría"
    }
  ],
  "total": 1000.00
}

Categorías posibles para items: ${formatCategories(ticketItemCategories)}.

Si no puedes leer algún campo, usa valores razonables basados en el contexto. La fecha debe estar en formato YYYY-MM-DD. Los precios deben ser números decimales.`;
