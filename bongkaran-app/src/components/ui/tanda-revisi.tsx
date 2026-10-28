import { Wrench } from 'lucide-react'
import { revisiDari } from '@/lib/revisi'
import { cn } from '@/lib/utils'

const waktu = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const bln = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()]
  return `${d.getDate()} ${bln} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Catatan "Revised by Developer" pada data riwayat yang pernah diubah super admin (Admin Aplikasi).
 * `ringkas`: lencana kecil untuk daftar; tanpa `ringkas`: baris keterangan lengkap dengan waktu revisi.
 */
export function TandaRevisi({ dari, ringkas = false, className }: { dari: unknown; ringkas?: boolean; className?: string }) {
  const r = revisiDari(dari)
  if (!r) return null
  const kali = r.kali && r.kali > 1 ? ` (${r.kali}×)` : ''
  return ringkas ? (
    <span
      title={`Revised by Developer · ${waktu(r.at)}${kali}`}
      className={cn('inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-800', className)}
    >
      <Wrench aria-hidden="true" className="size-3" />
      Revised by Developer
    </span>
  ) : (
    <span role="note" className={cn('flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-space-sm py-1.5 text-body-sm text-violet-900', className)}>
      <Wrench aria-hidden="true" className="size-4 shrink-0 text-violet-700" />
      <span>
        <b>Revised by Developer</b> · {waktu(r.at)}
        {kali}
      </span>
    </span>
  )
}
