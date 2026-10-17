import { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/lib/app-state'
import type { Catatan, JenisCatatan } from '@/lib/catatan'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Catatan totalizer/closing/stock opname pada rentang tanggal; dimuat ulang saat SPBU/rentang berubah. */
export function useCatatan<T>(jenis: JenisCatatan, from: string, to: string) {
  const app = useApp()
  const kunci = `${app.spbuId}|${jenis}|${from}|${to}`
  const [hasil, setHasil] = useState<{ kunci: string; recs: Catatan<T>[]; error: string | null } | null>(null)
  const muat = useCallback(
    () =>
      app.backend.listCatatan<T>(jenis, from, to).then(
        (recs) => setHasil({ kunci, recs, error: null }),
        (e) => setHasil({ kunci, recs: [], error: pesan(e) }),
      ),
    [app.backend, jenis, from, to, kunci],
  )
  useEffect(() => {
    void muat()
  }, [muat])
  const kini = hasil?.kunci === kunci ? hasil : null
  return { recs: kini?.recs ?? null, error: kini?.error ?? null, muat }
}
