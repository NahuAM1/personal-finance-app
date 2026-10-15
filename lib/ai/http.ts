import { NextResponse } from "next/server";
import { ApiError } from "@google/genai";
import { AiUnavailableError } from "@/lib/ai/gateway";

const UNAVAILABLE_MESSAGE: string =
  "El servicio de IA no está disponible en este momento. Probá de nuevo en unos minutos.";
const RATE_LIMITED_MESSAGE: string =
  "Se alcanzó el límite de consultas. Intentá de nuevo en unos segundos.";
const UPSTREAM_ERROR_MESSAGE: string =
  "El servicio de IA devolvió un error. Probá de nuevo en unos minutos.";

export function aiErrorResponse(error: Error): NextResponse | null {
  if (error instanceof AiUnavailableError) {
    return error.rateLimited
      ? NextResponse.json(
          { error: RATE_LIMITED_MESSAGE },
          { status: 429, headers: { "Retry-After": "10" } },
        )
      : NextResponse.json(
          { error: UNAVAILABLE_MESSAGE },
          { status: 503, headers: { "Retry-After": "30" } },
        );
  }

  if (error instanceof ApiError) {
    return NextResponse.json({ error: UPSTREAM_ERROR_MESSAGE }, { status: 502 });
  }

  return null;
}
