import { supabase } from '@/lib/supabase'
import { localBackend } from './local'
import { createSupabaseBackend } from './supabase'
import type { Backend } from './types'

/**
 * Supabase bila VITE_SUPABASE_URL & VITE_SUPABASE_PUBLISHABLE_KEY tersedia,
 * selain itu penyimpanan lokal di perangkat ini.
 */
export const backend: Backend = supabase ? createSupabaseBackend(supabase) : localBackend

export type { Backend, Member, RingkasanUnit, Role, SessionInfo, Spbu } from './types'
