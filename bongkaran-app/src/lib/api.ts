import { currentUser, recentReports, recentUnloadings } from '@/data/mock'
import { BUCKET_BUKTI, supabase } from '@/lib/supabase'
import type { Bongkaran, BongkaranBaru, JenisLaporan, Laporan } from '@/lib/types'

/*
 * Every read and write goes through here. Without Supabase env vars the
 * functions fall back to the sample data in data/mock.ts (reads) or throw
 * a clear message (writes), so the UI never has to branch on the backend.
 */

export const isLive = supabase !== null

function sampleBongkaran(): Bongkaran[] {
  const now = Date.now()
  return recentUnloadings.map((u, i) => ({
    id: `contoh-${u.id}`,
    created_at: new Date(now - i * 3_600_000).toISOString(),
    spbu: currentUser.spbu,
    waktu_bongkar: new Date(now - i * 3_600_000 * (i === 2 ? 20 : 1)).toISOString(),
    no_polisi: u.plate,
    produk: u.product,
    volume_do: u.volumeDo,
    volume_realisasi: u.volumeReal,
    catatan: null,
    foto_do_path: null,
    suhu_observasi: null,
    density_observasi: null,
    density_koreksi: null,
    pengawas: null,
    tera_bejana: null,
    meter_awal: null,
    meter_akhir: null,
    foto_tera_path: null,
    tahap: 'selesai',
    qq_status: u.qqStatus,
    qq_catatan: u.qqStatus === 'perhatian' ? u.qqNote : null,
  }))
}

function sampleLaporan(): Laporan[] {
  return recentReports.map((r, i) => ({
    id: `contoh-${r.id}`,
    created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    judul: r.title,
    jenis: r.title.startsWith('BA') ? 'berita_acara' : 'harian',
    spbu: r.spbu,
    status: r.status,
    bongkaran_id: null,
  }))
}

function need() {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).')
  return supabase
}

/** Unloadings on or after `sinceIso`, newest first. */
export async function listBongkaran({ sinceIso, limit = 200 }: { sinceIso?: string; limit?: number } = {}) {
  if (!supabase) {
    const rows = sampleBongkaran()
    return sinceIso ? rows.filter((r) => r.waktu_bongkar >= sinceIso) : rows
  }
  let q = supabase.from('bongkaran').select('*').order('waktu_bongkar', { ascending: false }).limit(limit)
  if (sinceIso) q = q.gte('waktu_bongkar', sinceIso)
  const { data, error } = await q
  if (error) throw error
  return data as Bongkaran[]
}

export async function countBongkaran() {
  if (!supabase) return { total: currentUser.stats.validated, sesuai: 0 }
  const [all, ok] = await Promise.all([
    supabase.from('bongkaran').select('id', { count: 'exact', head: true }).eq('tahap', 'selesai'),
    supabase.from('bongkaran').select('id', { count: 'exact', head: true }).eq('qq_status', 'sesuai'),
  ])
  if (all.error) throw all.error
  if (ok.error) throw ok.error
  return { total: all.count ?? 0, sesuai: ok.count ?? 0 }
}

export async function createBongkaran(row: BongkaranBaru) {
  const { data, error } = await need().from('bongkaran').insert(row).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function updateBongkaran(id: string, patch: Partial<Bongkaran>) {
  const { error } = await need().from('bongkaran').update(patch).eq('id', id)
  if (error) throw error
}

/** Uploads a photo to the private evidence bucket and returns its storage path. */
export async function uploadBukti(file: File, folder: string) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await need().storage.from(BUCKET_BUKTI).upload(path, file, { contentType: file.type })
  if (error) throw error
  return path
}

export async function listLaporan(limit = 50) {
  if (!supabase) return sampleLaporan()
  const { data, error } = await supabase.from('laporan').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data as Laporan[]
}

export async function createLaporan(row: { judul: string; jenis: JenisLaporan; spbu: string; bongkaran_id?: string | null }) {
  const { error } = await need().from('laporan').insert({ ...row, status: 'draft' })
  if (error) throw error
}
