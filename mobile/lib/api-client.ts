import { supabase } from '@/lib/supabase';

const API_BASE: string = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiPost<TRequest, TResponse>(path: string, body: TRequest): Promise<ApiResponse<TResponse>> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const json: TResponse = await res.json();
    if (!res.ok) return { ok: false, data: null, error: `HTTP ${res.status}` };
    return { ok: true, data: json, error: null };
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function apiPostMultipart<TResponse>(path: string, form: FormData): Promise<ApiResponse<TResponse>> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: form,
    });
    const json: TResponse = await res.json();
    if (!res.ok) return { ok: false, data: null, error: `HTTP ${res.status}` };
    return { ok: true, data: json, error: null };
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function apiGet<TResponse>(path: string): Promise<ApiResponse<TResponse>> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}${path}`, { headers });
    const json: TResponse = await res.json();
    if (!res.ok) return { ok: false, data: null, error: `HTTP ${res.status}` };
    return { ok: true, data: json, error: null };
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}
