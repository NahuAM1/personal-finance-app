import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { USER_ROLES, type UserRole } from "@/types/database";
import { OpenAIModels } from "@/public/enums";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

const SCAN_PROMPT = `Eres un experto en OCR de tickets de compra. Analiza la imagen del ticket y extrae la información en formato JSON estricto.

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

Categorías posibles para items: "Lácteos", "Carnes", "Frutas y Verduras", "Panadería", "Bebidas", "Limpieza", "Higiene", "Snacks", "Congelados", "Condimentos", "Almacén", "Otros".

Si no puedes leer algún campo, usa valores razonables basados en el contexto. La fecha debe estar en formato YYYY-MM-DD. Los precios deben ser números decimales.`;

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorizedRoles: UserRole[] = [USER_ROLES.PREMIUM, USER_ROLES.ADMIN];
  const userRole = user.app_metadata?.role;

  if (!authorizedRoles.includes(userRole)) {
    return NextResponse.json(
      { error: "Forbidden: Premium required" },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Convert image to base64 for Gemini
    const bytes = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString("base64");
    const mimeType = imageFile.type || "image/jpeg";

    // Upload image to Supabase Storage
    const ticketId = crypto.randomUUID();
    const ext = imageFile.name.split(".").pop() || "jpg";
    const storagePath = `${user.id}/${ticketId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, Buffer.from(bytes), {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 },
      );
    }

    // Call Gemini via OpenRouter for OCR
    const response = await openai.chat.completions.create({
      model: OpenAIModels.QWEN_VL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SCAN_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
    });

    const rawContent = response.choices[0]?.message?.content || "";

    // Parse the JSON response
    const jsonMatch =
      rawContent.match(/```json([\s\S]*?)```/) ||
      rawContent.match(/```([\s\S]*?)```/) ||
      rawContent.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : rawContent;

    let parsed: {
      store_name: string;
      ticket_date: string;
      items: {
        product_name: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        category: string;
      }[];
      total: number;
    };

    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      console.error("Failed to parse OCR response:", rawContent);
      // Clean up uploaded image on parse failure
      await supabase.storage.from("receipts").remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to parse ticket data from AI response" },
        { status: 500 },
      );
    }

    // Create ticket record
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert([
        {
          id: ticketId,
          user_id: user.id,
          store_name: parsed.store_name,
          total_amount: parsed.total,
          ticket_date: parsed.ticket_date,
          image_path: storagePath,
        },
      ])
      .select()
      .single();

    if (ticketError) {
      await supabase.storage.from("receipts").remove([storagePath]);
      throw ticketError;
    }

    // Create ticket items
    const items = parsed.items.map((item) => ({
      ticket_id: ticketId,
      product_name: item.product_name,
      quantity: item.quantity || 1,
      unit_price: item.unit_price,
      total_price: item.total_price,
      category: item.category || "Otros",
    }));

    const { data: ticketItems, error: itemsError } = await supabase
      .from("ticket_items")
      .insert(items)
      .select();

    if (itemsError) {
      console.error("Error creating ticket items:", itemsError);
    }

    return NextResponse.json({
      ticket,
      items: ticketItems || [],
    });
  } catch (error) {
    console.error("Error scanning receipt:", error);
    return NextResponse.json(
      { error: "Error processing receipt" },
      { status: 500 },
    );
  }
}
