import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BrushCleaning, CalendarClock, ChevronDown, ChevronRight, CircleAlert, Clock, Inbox as InboxIcon, Stamp, Wrench, Zap, type LucideIcon } from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { useMenu } from '@/components/shell/menu-data'
import { GlassCard } from '@/components/ui/glass-card'
import { InfoPop } from '@/components/ui/info-pop'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { SELANG_BULAN, type GroundingData } from '@/lib/grounding'
import { tambahBulan } from '@/lib/berlaku'
import { useCatatan } from '@/lib/use-catatan'
import { GRUP_PERSETUJUAN, useInbox, type ItemInbox } from '@/lib/use-inbox'
import { cn } from '@/lib/utils'

const NADA: Record<ItemInbox['tingkat'], { kelas: string; Ikon: typeof Clock }> = {
  tugas: { kelas: 'bg-orange-500 text-white', Ikon: Clock },
  lewat: { kelas: 'bg-red-600 text-white', Ikon: CircleAlert },
  segera: { kelas: 'bg-amber-400 text-amber-950', Ikon: CalendarClock },
}

const IKON_GRUP: Record<string, LucideIcon> = { Perawatan: Wrench, Housekeeping: BrushCleaning, [GRUP_PERSETUJUAN]: Stamp }
const URUT: Record<ItemInbox['tingkat'], number> = { lewat: 0, tugas: 1, segera: 2 }

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

/** Inbox: notifikasi per modul (dropdown): tugas yang perlu dikerjakan dan masa berlaku yang habis / segera habis. */
export function Inbox() {
  const app = useApp()
  const items = useInbox()
  const menu = useMenu()
  const [buka, setBuka] = useState<Set<string>>(new Set())
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
  const semua = [...items, ...(groundingItem ? [{ ...groundingItem, grup: 'HSSE & Guard Patrol System' }] : [])]
  // Satu dropdown per modul utama (urutan menu), lalu Perawatan, Housekeeping, Paraf pengawas.
  // Persetujuan & paraf (menunggu PIC) selalu paling atas.
  const urutan = [GRUP_PERSETUJUAN, ...menu.filter((g) => g.key !== 'dashboard' && g.key !== 'report').map((g) => g.label), 'Perawatan', 'Housekeeping']
  const grup = [...new Set([...urutan, ...semua.map((x) => x.grup)])]
    .map((g) => ({ label: g, Ikon: IKON_GRUP[g] ?? menu.find((m) => m.label === g)?.icon ?? InboxIcon, isi: semua.filter((x) => x.grup === g).sort((a, b) => URUT[a.tingkat] - URUT[b.tingkat]) }))
    .filter((g) => g.isi.length)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex items-center gap-space-sm p-space-md">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary">
          <InboxIcon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-headline-md font-bold text-on-surface">{semua.length ? `${semua.length} notifikasi` : 'Tidak ada notifikasi'}</span>
          {grup.length > 0 && <span className="text-body-sm text-on-surface-variant">{grup.length} modul · ketuk modul untuk melihat rincian</span>}
        </span>
        <InfoPop judul="Inbox">
          <p>Tugas pengisian yang belum dikerjakan dan masa berlaku yang habis atau ≤ 30 hari lagi, dikelompokkan per modul.</p>
          <p>Notifikasi hilang otomatis setelah dikerjakan.</p>
        </InfoPop>
      </GlassCard>

      {grup.map((g, i) => {
        const terbuka = buka.has(g.label)
        const lewat = g.isi.filter((x) => x.tingkat === 'lewat').length
        return (
          <GlassCard key={g.label} level={2} className={cn('flex flex-col overflow-hidden', i < 4 && ['animate-entrance-2', 'animate-entrance-2', 'animate-entrance-3', 'animate-entrance-3'][i])}>
            <button
              type="button"
              aria-expanded={terbuka}
              onClick={() => setBuka((x) => { const y = new Set(x); if (y.has(g.label)) y.delete(g.label); else y.add(g.label); return y })}
              className="flex min-h-16 items-center gap-space-sm px-space-md py-space-sm text-left active:bg-surface-container-low"
            >
              <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-fixed text-primary">
                <g.Ikon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-md font-bold text-on-surface">{g.label}</span>
                <span className="truncate text-body-sm text-on-surface-variant">{g.isi.map((x) => x.judul).join(', ')}</span>
              </span>
              <span className={cn('tabular flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-body-sm font-bold', lewat ? 'bg-error text-on-error' : 'bg-amber-400 text-amber-950')}>{g.isi.length}</span>
              <ChevronDown aria-hidden="true" className={cn('size-5 shrink-0 text-on-surface-variant transition-transform', terbuka && 'rotate-180')} />
            </button>
            {terbuka && (
              <div className="flex flex-col divide-y divide-outline-variant/40 border-t border-outline-variant/40">
                {g.isi.map((x) => (
                  <Baris key={x.id} x={x} />
                ))}
              </div>
            )}
          </GlassCard>
        )
      })}

      {!semua.length && (
        <GlassCard level={1} className="flex flex-col items-center gap-space-xs p-space-lg text-center">
          <Zap aria-hidden="true" className="size-6 text-emerald-600" />
          <span className="text-body-md font-semibold text-on-surface">Semua tugas sudah dikerjakan</span>
        </GlassCard>
      )}
    </div>
  )
}
