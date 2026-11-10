import { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/lib/app-state'
import type { OpsRecord } from '@/lib/ops'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Catatan bbm_ops pada rentang tanggal; dimuat ulang saat SPBU/rentang berubah. */
export function useOps(from: string, to: string) {
  const app = useApp()
  const kunci = `${app.spbuId}|${from}|${to}`
  const [hasil, setHasil] = useState<{ kunci: string; recs: OpsRecord[]; error: string | null } | null>(null)
  const muat = useCallback(
    () =>
      app.backend.listOps(from, to).then(
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
