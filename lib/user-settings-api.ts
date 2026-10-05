import { supabase } from "@/lib/supabase"
import {
  DEFAULT_ARS_RATE_TYPE,
  DEFAULT_BASE_CURRENCY,
  isArsRateType,
} from "@/lib/currency/currencies"
import type { ArsRateType, UserSettings } from "@/types/database"

export function defaultUserSettings(userId: string): UserSettings {
  const now = new Date().toISOString()
  return {
    user_id: userId,
    base_currency: DEFAULT_BASE_CURRENCY,
    ars_rate_type: DEFAULT_ARS_RATE_TYPE,
    pending_base_currency: null,
    reconversion_status: "idle",
    reconversion_started_at: null,
    reconversion_error: null,
    created_at: now,
    updated_at: now,
  }
}

/** Returns the user's settings, or the defaults (ARS / oficial) when no row exists. */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("Error loading user settings:", error)
    return defaultUserSettings(userId)
  }
  return (data as UserSettings | null) ?? defaultUserSettings(userId)
}

/**
 * Updates only `ars_rate_type`. The base currency can only change through the
 * reconversion route (column grants block direct updates).
 */
export async function updateArsRateType(userId: string, type: ArsRateType): Promise<void> {
  if (!isArsRateType(type)) throw new Error("Tipo de cotización inválido")

  const { data, error } = await supabase
    .from("user_settings")
    .update({ ars_rate_type: type, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("user_id")

  if (error) throw error
  if (data && data.length > 0) return

  // No row yet: create it with the chosen rate type (base currency defaults to ARS).
  const { error: insertError } = await supabase
    .from("user_settings")
    .insert({ user_id: userId, ars_rate_type: type })
  if (insertError) throw insertError
}
