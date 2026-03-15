import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** Returns true when Supabase env vars are configured */
export const supabaseEnabled = !!(url && key)

// Only create the client when env vars are available to avoid runtime errors during SSR/build
export const supabase = supabaseEnabled
  ? createClient(url, key)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')
