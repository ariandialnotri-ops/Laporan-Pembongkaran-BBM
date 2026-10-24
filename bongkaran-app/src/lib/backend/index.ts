import { pantau } from '@/lib/proses'
import { supabase } from '@/lib/supabase'
import { localBackend } from './local'
import { createSupabaseBackend } from './supabase'
import type { Backend } from './types'

/**
 * Supabase bila VITE_SUPABASE_URL & VITE_SUPABASE_PUBLISHABLE_KEY tersedia,
 * selain itu penyimpanan lokal di perangkat ini. Setiap kirim/unggah/hapus dilacak
 * untuk lembar proses ("Memproses…" → "Berhasil!").
 */
export const backend: Backend = pantau(supabase ? createSupabaseBackend(supabase) : localBackend)

export type { Backend, FotoArsip, Member, RingkasanUnit, Role, SessionInfo, Spbu } from './types'
