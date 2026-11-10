import type { JadwalData } from '@/lib/personil'
import { useCatatan } from '@/lib/use-catatan'

/** Jadwal shift bulan `bulan` (YYYY-MM); undefined = masih dimuat, null = belum dibuat. */
export function useJadwal(bulan: string) {
  const { recs, error, muat } = useCatatan<JadwalData>('jadwal', `${bulan}-01`, `${bulan}-01`)
  return { jadwal: recs ? (recs.find((r) => r.id === bulan) ?? null) : undefined, error, muat }
}
