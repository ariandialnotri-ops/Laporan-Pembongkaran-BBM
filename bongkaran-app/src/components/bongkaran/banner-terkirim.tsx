import type { ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'

/** Banner hijau di halaman riwayat setelah data dikirim; baris barunya disorot biru. */
export function BannerTerkirim({ teks, children }: { teks: string; children?: ReactNode }) {
  return (
    <div role="status" className="animate-entrance-1 flex items-start gap-space-sm rounded-lg bg-emerald-50 p-space-sm">
      <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
      <div className="flex min-w-0 flex-1 flex-col gap-space-xs">
        <span className="text-body-sm text-on-surface">{teks}</span>
        {children}
      </div>
    </div>
  )
}
