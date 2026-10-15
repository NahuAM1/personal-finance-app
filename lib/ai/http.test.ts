import { describe, expect, it } from 'vitest';
import { ApiError } from '@google/genai';
import { AiTask, AiUnavailableError } from '@/lib/ai/gateway';
import { aiErrorResponse } from '@/lib/ai/http';

describe('aiErrorResponse', () => {
  it('answers 503 with a retry hint when Gemini stayed unavailable', async () => {
    const response = aiErrorResponse(new AiUnavailableError(AiTask.SCAN_RECEIPT, false));

    expect(response?.status).toBe(503);
    expect(response?.headers.get('Retry-After')).toBe('30');
    expect(await response?.json()).toEqual({
      error: 'El servicio de IA no está disponible en este momento. Probá de nuevo en unos minutos.',
    });
  });

  it('keeps answering 429 with the rate limit message when Gemini kept throttling', async () => {
    const response = aiErrorResponse(new AiUnavailableError(AiTask.AGENT_REPLY, true));

    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBe('10');
    expect(await response?.json()).toEqual({
      error: 'Se alcanzó el límite de consultas. Intentá de nuevo en unos segundos.',
    });
  });

  it('answers 502 when Gemini rejected the request', async () => {
    const response = aiErrorResponse(new ApiError({ message: 'Bad request', status: 400 }));

    expect(response?.status).toBe(502);
    expect(await response?.json()).toEqual({
      error: 'El servicio de IA devolvió un error. Probá de nuevo en unos minutos.',
    });
  });

  it('leaves errors that did not come from Gemini to the route', () => {
    expect(aiErrorResponse(new Error('insert failed'))).toBeNull();
  });
});
