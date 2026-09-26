import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL 
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY 

/**
 * Null when the env vars are missing — the app then runs on sample data so
 * `npm run dev` works without a backend.
 */
export const supabase = url && key ? createClient(url, key) : null

export const BUCKET_BUKTI = 'bukti-bongkaran'
