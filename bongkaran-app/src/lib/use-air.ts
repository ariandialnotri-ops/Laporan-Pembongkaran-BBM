import { useCallback, useEffect, useState } from 'react'
import type { AirRecord } from '@/lib/air'
import { useApp } from '@/lib/app-state'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Catatan water content pada rentang tanggal; dimuat ulang saat SPBU/rentang berubah. */
export function useAir(from: string, to: string) {
  const app = useApp()
  const kunci = `${app.spbuId}|${from}|${to}`
  const [hasil, setHasil] = useState<{
    kunci: string
    recs: AirRecord[]
    error: string | null
  } | null>(null)
  const muat = useCallback(
    () =>
      app.backend.listAir(from, to).then(
        (recs) => setHasil({ kunci, recs, error: null }),
        (e) => setHasil({ kunci, recs: [], error: pesan(e) }),
      ),
    [app.backend, from, to, kunci],
  )
  useEffect(() => {
    void muat()
  }, [muat])
  const kini = hasil?.kunci === kunci ? hasil : null
  return { recs: kini?.recs ?? null, error: kini?.error ?? null, muat }
}
