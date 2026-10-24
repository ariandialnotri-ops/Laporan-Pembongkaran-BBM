import { Link, useParams } from 'react-router-dom'
import { Check, Clock, History, Lock, MapPin, PencilLine, Truck } from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { ProdukChip } from '@/components/bongkaran/record-table'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import { loStatus, loStatusMeta, planSupply } from '@/lib/plan'
import type { JejakPlan, Plan, PlanLo, ReportSummary } from '@/lib/sop'
import { cn } from '@/lib/utils'

const BLN = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
const jam = (d: Date) => `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
const waktuLengkap = (ms: number) => {
  const d = new Date(ms)
  return `${formatTanggalIso(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)}, ${jam(d)}`
}
/** "YYYY-MM-DD" + "HH:MM" → epoch ms waktu lokal. */
const dariTanggalJam = (tanggal: string, j?: string) => (tanggal ? Date.parse(`${tanggal}T${j && /^\d{2}:\d{2}/.test(j) ? j.slice(0, 5) : '00:00'}`) : NaN)

type Tahap = {
  judul: string
  /** Epoch ms; NaN/undefined = belum ada waktu. */
  waktu?: number
  rinci: string[]
  tag?: string
  selesai: boolean
  nada?: 'normal' | 'error' | 'cyan'
}

/** Tahap pengiriman satu LO, dari permintaan MS2 sampai closed; waktu diambil dari riwayat perubahan & bongkaran. */
function tahapLo(plan: Plan, lo: PlanLo, report: ReportSummary | undefined, status: ReturnType<typeof loStatus>): Tahap[] {
  const rw = plan.riwayat ?? []
  const akhir = (f: (x: JejakPlan) => boolean) => [...rw].reverse().find(f)?.waktu
  const urut = ['proses', 'os', 'planned', 'delivery', 'delivered', 'closed']
  const lewat = (k: string) => urut.indexOf(status) >= urut.indexOf(k)
  const tahap: Tahap[] = [
    {
      judul: 'Permintaan MS2',
      waktu: akhir((x) => x.jenis === 'buat') ?? plan.createdAt,
      rinci: [
        `MS2 ${plan.ms2Tanggal ? formatTanggalIso(plan.ms2Tanggal) : '-'}${plan.ms2Jam ? `, ${plan.ms2Jam.replace(':', '.')}` : ''}${lo.shift ? ` · shift ${lo.shift}` : ''}`,
        `Kirim ${formatTanggalIso(plan.tanggal)}${plan.poSap ? ` · PO SAP ${plan.poSap}` : ''}`,
      ],
      tag: 'SUBMIT',
      selesai: true,
    },
    {
      judul: 'SO terbit',
      waktu: plan.noSO.trim() ? akhir((x) => x.jenis === 'so') : undefined,
      rinci: [plan.noSO.trim() ? `No SO ${plan.noSO}` : 'Menunggu approval SO dari depot'],
      selesai: !!plan.noSO.trim(),
    },
    {
      judul: 'LO terbit',
      waktu: lo.noLO.trim() ? akhir((x) => x.jenis === 'lo' && x.loId === lo.id) : undefined,
      rinci: lo.noLO.trim()
        ? [`No LO ${lo.noLO}${lo.noLOLama ? ` (dari LO ${lo.noLOLama})` : ''}`, `Supply point ${planSupply(plan, lo) || '-'}${lo.segel.length ? ` · segel ${lo.segel.join(', ')}` : ''}`]
        : ['Menunggu LO dari depot'],
      selesai: !!lo.noLO.trim(),
    },
    {
      judul: 'Dalam pengiriman',
      waktu: akhir((x) => x.jenis === 'status' && x.loId === lo.id && (x.status === 'planned' || x.status === 'delivery')),
      rinci: [lewat('planned') ? (status === 'planned' ? 'Planned: menunggu antrian MT' : 'Pengisian / pengiriman MT') : 'Belum dijadwalkan pengiriman'],
      tag: status === 'planned' ? 'PLANNED' : status === 'delivery' ? 'ON DELIVERY' : undefined,
      selesai: lewat('delivery') || status === 'planned',
    },
    {
      judul: 'Diterima di SPBU',
      waktu: report ? dariTanggalJam(report.tanggal, report.jam) : undefined,
      rinci: report ? [`MT ${report.nopol || '-'} · bongkar ${report.tanggal ? formatTanggalIso(report.tanggal) : '-'}${report.jam ? `, ${report.jam.replace(':', '.')}` : ''}`] : ['Belum dibongkar di SPBU'],
      tag: report ? 'DELIVERED' : undefined,
      selesai: !!report,
    },
    {
      judul: 'Closed',
      waktu: status === 'closed' && report ? dariTanggalJam(report.tanggal, report.jamSelesai) : undefined,
      rinci: [status === 'closed' ? `Bongkar & administrasi selesai${report?.noBA ? ` · BA ${report.noBA}` : ''}` : 'Menunggu bongkar & BA selesai'],
      tag: status === 'closed' ? 'CLOSED' : undefined,
      selesai: status === 'closed',
    },
  ]
  if (status === 'deleted')
    tahap.push({ judul: 'LO dihapus', waktu: akhir((x) => x.jenis === 'status' && x.loId === lo.id && x.status === 'deleted'), rinci: ['Dihapus oleh Supply Chain atau depot'], tag: 'DELETED', selesai: true, nada: 'error' })
  if (status === 'alih' || lo.supplyPointLama)
    tahap.splice(3, 0, { judul: 'Alih supply', waktu: akhir((x) => x.loId === lo.id && x.teks.startsWith('Alih supply')), rinci: [`Ke ${planSupply(plan, lo) || '-'}${lo.supplyPointLama ? ` dari ${lo.supplyPointLama}` : ''}`], tag: 'ALIH', selesai: true, nada: 'cyan' })
  return tahap
}

/** Laporan > Tracking LO > detail satu LO: stepper tahap pengiriman, tombol edit/update, dan riwayat perubahan. */
export function DetailLo() {
  const app = useApp()
  const { planId = '', loId = '' } = useParams()
  useSyncOnOpen()
  if (!app.loaded) return <Loading />
  const plan = app.plans.find((p) => p.id === planId)
  const lo = plan?.los.find((x) => x.id === loId)
  if (!plan || !lo)
    return (
      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <span className="text-body-md font-bold text-on-surface">LO tidak ditemukan</span>
        <span className="text-body-sm text-on-surface-variant">LO ini mungkin sudah dihapus dari perangkat lain.</span>
        <Link to="/laporan/lo" className={buttonVariants({ variant: 'glass' })}>
          Kembali ke Tracking LO
        </Link>
      </GlassCard>
    )
  const report = app.usedLoIds.get(lo.id)
  const status = loStatus(lo, app.usedLoIds)
  const meta = loStatusMeta(status)
  const tahap = tahapLo(plan, lo, report, status)
  const kini = tahap.findIndex((t) => !t.selesai)
  const terkunci = status === 'closed'
  const bolehUbah = app.can(`/plan/so/${plan.id}`)
  const riwayat = (plan.riwayat ?? []).filter((x) => !x.loId || x.loId === lo.id).reverse()
  const keEdit = `/plan/so/${encodeURIComponent(plan.id)}?lo=${encodeURIComponent(lo.id)}&dari=${encodeURIComponent(`/laporan/lo/${plan.id}/${lo.id}`)}`

  return (
    <div className="flex flex-col gap-space-md lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      {/* Ringkasan LO + aksi */}
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md lg:col-span-2">
        <div className="flex items-start justify-between gap-space-sm">
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Loading Order</span>
            <span className="tabular truncate text-headline-md font-bold text-on-surface">{lo.noLO ? `LO ${lo.noLO}` : 'LO belum terbit'}</span>
            <span className="tabular text-body-sm text-on-surface-variant">SO {plan.noSO || 'belum terbit'}</span>
          </span>
          <Pill tone={meta.tone}>
            {terkunci && <Lock aria-hidden="true" />}
            {meta.label}
          </Pill>
        </div>
        <div className="flex flex-wrap items-center gap-space-xs text-body-sm text-on-surface">
          <ProdukChip produk={lo.produk} />
          <span className="tabular font-semibold">{formatNumber(lo.volume)} L</span>
          <span className="flex items-center gap-1 text-on-surface-variant">
            <MapPin aria-hidden="true" className="size-4" />
            {planSupply(plan, lo) || '-'}
          </span>
          <span className="flex items-center gap-1 text-on-surface-variant">
            <Truck aria-hidden="true" className="size-4" />
            Kirim {formatTanggalIso(plan.tanggal)}
          </span>
        </div>
        {bolehUbah &&
          (terkunci ? (
            <span className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container-high text-body-md font-semibold text-on-surface-variant">
              <Lock aria-hidden="true" className="size-4" />
              LO Closed terkunci, tidak dapat diubah
            </span>
          ) : (
            <Link to={keEdit} className={buttonVariants({ size: 'lg' })}>
              <PencilLine aria-hidden="true" />
              Edit / update pengiriman
            </Link>
          ))}
      </GlassCard>

      {/* Stepper tahap pengiriman */}
      <GlassCard level={2} className="animate-entrance-2 flex flex-col p-space-md">
        <h2 className="mb-space-sm flex items-center gap-2 text-body-md font-bold text-on-surface">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          Tahap pengiriman
          <span className="text-body-sm font-medium text-on-surface-variant">
            ({tahap.filter((t) => t.selesai).length}/{tahap.length})
          </span>
        </h2>
        <ol className="flex flex-col">
          {tahap.map((t, i) => {
            const aktif = i === kini
            const ada = t.waktu !== undefined && Number.isFinite(t.waktu)
            const d = ada ? new Date(t.waktu!) : null
            const warna = t.nada === 'error' ? 'bg-error text-on-error' : t.nada === 'cyan' ? 'bg-cyan-600 text-white' : t.selesai ? 'bg-emerald-600 text-white' : aktif ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            const garis = t.selesai ? (t.nada === 'error' ? 'bg-error/50' : 'bg-emerald-500') : 'bg-outline-variant/60'
            return (
              <li key={t.judul} className="flex gap-space-sm" aria-current={aktif ? 'step' : undefined}>
                {/* Kolom tanggal + bulatan + garis */}
                <div className="flex w-11 shrink-0 flex-col items-center">
                  <span className={cn('h-4 text-[11px] font-bold leading-4 tracking-wide', t.selesai || aktif ? 'text-primary' : 'text-transparent')}>{d ? BLN[d.getMonth()] : '·'}</span>
                  <span className={cn('tabular relative flex size-9 shrink-0 items-center justify-center rounded-full text-body-sm font-bold shadow-sm', warna, aktif && 'ring-4 ring-primary/20')}>
                    {d ? String(d.getDate()).padStart(2, '0') : t.selesai ? <Check aria-hidden="true" className="size-4" /> : i + 1}
                  </span>
                  {i < tahap.length - 1 && <span aria-hidden="true" className={cn('my-1 w-0.5 flex-1 rounded-full', garis)} />}
                </div>
                {/* Kartu tahap */}
                <div className={cn('mb-space-sm mt-4 flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border p-space-sm', aktif ? 'border-primary/40 bg-primary/5' : 'border-outline-variant/40 bg-surface-container-lowest', !t.selesai && !aktif && 'opacity-70')}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-body-md font-bold text-on-surface">{t.judul}</span>
                    {t.tag && <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-bold tracking-wide', t.nada === 'error' ? 'bg-error-container text-on-error-container' : 'bg-primary/10 text-primary')}>{t.tag}</span>}
                  </span>
                  <span className="tabular flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
                    <Clock aria-hidden="true" className="size-3.5" />
                    {ada ? waktuLengkap(t.waktu!) : aktif ? 'Sedang berjalan' : t.selesai ? 'Waktu tidak tercatat' : 'Belum'}
                  </span>
                  {t.rinci.map((r) => (
                    <span key={r} className="tabular text-body-sm text-on-surface-variant">
                      {r}
                    </span>
                  ))}
                </div>
              </li>
            )
          })}
        </ol>
      </GlassCard>

      {/* Riwayat submit & perubahan */}
      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
        <h2 className="flex items-center gap-2 text-body-md font-bold text-on-surface">
          <History aria-hidden="true" className="size-4 text-primary" />
          Riwayat submit & perubahan
        </h2>
        {riwayat.length ? (
          <ul className="flex flex-col divide-y divide-outline-variant/40">
            {riwayat.map((x, i) => (
              <li key={`${x.waktu}-${i}`} className="flex flex-col gap-0.5 py-space-xs">
                <span className="text-body-sm font-semibold text-on-surface">{x.teks}</span>
                <span className="tabular text-xs text-on-surface-variant">
                  {waktuLengkap(x.waktu)} · {x.oleh}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-body-sm text-on-surface-variant">Dibuat {waktuLengkap(plan.createdAt)}. Perubahan berikutnya tercatat otomatis di sini.</span>
        )}
      </GlassCard>
    </div>
  )
}
