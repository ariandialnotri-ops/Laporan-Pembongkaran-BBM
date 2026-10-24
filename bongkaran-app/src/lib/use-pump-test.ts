import { useMemo } from 'react'
import { useApp } from '@/lib/app-state'
import { pumpTestPerShift } from '@/lib/pumptest'

/** Pump test per tanggal/shift/produk dari data harian (uji kualitas, Q&Q, uji takaran): pengurang penjualan totalisator. */
export function usePumpTestShift() {
  const app = useApp()
  return useMemo(() => pumpTestPerShift(app.daily, app.settings.nozzles ?? []), [app.daily, app.settings.nozzles])
}
