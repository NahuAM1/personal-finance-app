import { createBrowserClient } from '@supabase/ssr'
import type { Database } from "@/types/database"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a single supabase client for interacting with your database
export const supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey
)
