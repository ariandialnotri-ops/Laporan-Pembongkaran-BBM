import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, CircleAlert, Clock, Inbox as InboxIcon, Zap } from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { SELANG_BULAN, type GroundingData } from '@/lib/grounding'
import { tambahBulan } from '@/lib/berlaku'
import { useCatatan } from '@/lib/use-catatan'
import { useInbox, type ItemInbox } from '@/lib/use-inbox'
import { cn } from '@/lib/utils'

const NADA: Record<ItemInbox['tingkat'], { kelas: string; Ikon: typeof Clock }> = {
  tugas: { kelas: 'bg-orange-500 text-white', Ikon: Clock },
  lewat: { kelas: 'bg-red-600 text-white', Ikon: CircleAlert },
  segera: { kelas: 'bg-amber-400 text-amber-950', Ikon: CalendarClock },
}

function Baris({ x }: { x: ItemInbox }) {
  const n = NADA[x.tingkat]
  return (
    <Link to={x.to} className="flex items-center gap-space-sm px-space-md py-space-sm active:bg-surface-container-low">
      <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', n.kelas)}>
        <n.Ikon className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-md font-semibold text-on-surface">{x.judul}</span>
        <span className="text-body-sm text-on-surface-variant">{x.detail}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
    </Link>
  )
}

/** Inbox: notifikasi tugas yang perlu dikerjakan dan masa berlaku yang habis / segera habis. */
export function Inbox() {
  const app = useApp()
  const items = useInbox()
  const hariIni = todayIso()
  // Pengukuran grounding ulang tiap 6 bulan (hanya peran yang mengukur).
  const ukur = app.can('/grounding') && ['abh', 'pengawas', 'kashift'].includes(app.role ?? '')
  const { recs: grounding } = useCatatan<GroundingData>('grounding', '2000-01-01', '2999-12-31')
  if (!app.loaded) return <Loading />
  const terakhir = (grounding ?? []).map((r) => r.tanggal).sort().at(-1)
  const jatuh = terakhir ? tambahBulan(terakhir, SELANG_BULAN) : ''
  const groundingItem: ItemInbox | null =
    ukur && grounding && (!terakhir || jatuh <= tambahBulan(hariIni, 1))
      ? {
          id: 'grounding',
          jenis: 'berlaku',
          judul: 'Pengukuran grounding ulang',
          detail: terakhir ? `Terakhir ${formatTanggalIso(terakhir)} · ukur ulang ${formatTanggalIso(jatuh)}` : 'Belum ada pengukuran tercatat',
          to: '/grounding',
          grup: 'Masa berlaku',
          tingkat: !terakhir || jatuh < hariIni ? 'lewat' : 'segera',
        }
      : null
  const tugas = items.filter((x) => x.jenis === 'tugas')
  const berlaku = [...items.filter((x) => x.jenis === 'berlaku'), ...(groundingItem ? [groundingItem] : [])].sort((a, b) => (a.tingkat === 'lewat' ? 0 : 1) - (b.tingkat === 'lewat' ? 0 : 1))
  const grupTugas = [...new Set(tugas.map((x) => x.grup))]

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex items-center gap-space-sm p-space-md">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary">
          <InboxIcon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-headline-md font-bold text-on-surface">{tugas.length + berlaku.length ? `${tugas.length + berlaku.length} notifikasi` : 'Tidak ada notifikasi'}</span>
          <span className="text-body-sm text-on-surface-variant">Tugas pengisian yang belum dikerjakan dan masa berlaku yang habis / ≤ 30 hari lagi. Notifikasi hilang otomatis setelah dikerjakan.</span>
        </span>
      </GlassCard>

      {grupTugas.map((g) => (
        <section key={g} aria-labelledby={`inbox-${g}`} className="animate-entrance-2 flex flex-col gap-space-sm">
          <SectionHeader id={`inbox-${g}`} title={`Tugas · ${g}`} />
          <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
            {tugas
              .filter((x) => x.grup === g)
              .map((x) => (
                <Baris key={x.id} x={x} />
              ))}
          </GlassCard>
        </section>
      ))}

      {berlaku.length > 0 && (
        <section aria-labelledby="inbox-berlaku" className="animate-entrance-3 flex flex-col gap-space-sm">
          <SectionHeader id="inbox-berlaku" title={`Masa berlaku (${berlaku.length})`} />
          <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
            {berlaku.map((x) => (
              <Baris key={x.id} x={x} />
            ))}
          </GlassCard>
        </section>
      )}

      {!tugas.length && !berlaku.length && (
        <GlassCard level={1} className="flex flex-col items-center gap-space-xs p-space-lg text-center">
          <Zap aria-hidden="true" className="size-6 text-emerald-600" />
          <span className="text-body-md font-semibold text-on-surface">Semua tugas sudah dikerjakan</span>
        </GlassCard>
      )}
    </div>
  )
}
