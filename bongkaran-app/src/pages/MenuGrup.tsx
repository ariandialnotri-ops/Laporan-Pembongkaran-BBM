import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CircleCheck, Fuel, Wallet } from 'lucide-react'
import { ArsipFotoBanner } from '@/components/bongkaran/arsip-foto'
import { KalengSample } from '@/components/bongkaran/kaleng-sample'
import { Loading } from '@/components/bongkaran/load-state'
import { MenuCard, type MenuItem } from '@/components/bongkaran/menu-card'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { TangkiBelumAda, useStokShift } from '@/components/bongkaran/stok-gate'
import { EXPORT, patrolItems, riwayatItems, useMenu, type GrupKey, type ItemMenu } from '@/components/shell/menu-data'
import { GlassCard } from '@/components/ui/glass-card'
import { useApp } from '@/lib/app-state'
import { todayIso } from '@/lib/date'
import { formTampil, statusOps, type OpsRecord } from '@/lib/ops'
import { shiftLabel } from '@/lib/shift'
import { cn } from '@/lib/utils'

function Grid({ items, label }: { items: MenuItem[]; label: string }) {
  return (
    <nav aria-label={label} className="grid grid-cols-2 gap-space-sm lg:grid-cols-3">
      {items.map((m, i) => (
        <MenuCard key={m.to} m={m} index={i} />
      ))}
    </nav>
  )
}

function Judul({ grup }: { grup: GrupKey }) {
  const g = useMenu().find((x) => x.key === grup)
  if (!g) return null
  const Icon = g.icon
  return (
    <div className="animate-entrance-1 flex items-center gap-space-sm px-space-xs">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-surface-container-lowest text-on-surface shadow-sm">
        <Icon className="size-5" strokeWidth={1.7} />
      </span>
      <span className="text-body-md text-on-surface-variant">{g.desc}</span>
    </div>
  )
}

/** Ikhtisar satu grup (Delivery, HSSE): kartu semua fitur di grup itu. */
export function MenuGrup({ grup }: { grup: Exclude<GrupKey, 'operation' | 'dashboard' | 'finance' | 'report'> }) {
  const app = useApp()
  const menu = useMenu()
  if (!app.loaded) return <Loading />
  const g = menu.find((x) => x.key === grup)
  return (
    <div className="flex flex-col gap-space-md">
      <Judul grup={grup} />
      {g ? <Grid items={g.items} label={`Menu ${g.label}`} /> : <Kosong />}
    </div>
  )
}

function Kosong() {
  return <GlassCard level={1} className="p-space-md text-body-md text-on-surface-variant">Tidak ada fitur di grup ini untuk peran Anda.</GlassCard>
}

/**
 * Operation: stok awal shift (kewajiban awal shift), bongkaran, kualitas harian & pasca
 * penerimaan, kaleng sample, uji takaran, perawatan & housekeeping.
 */
export function MenuOperation() {
  const app = useApp()
  const stok = useStokShift()
  const menu = useMenu()
  // Status form operasional hari ini (tabel terpisah, dimuat saat halaman dibuka).
  const [ops, setOps] = useState<OpsRecord[] | null>(null)
  useEffect(() => {
    let hidup = true
    app.backend.listOps(todayIso(), todayIso()).then(
      (r) => hidup && setOps(r),
      () => hidup && setOps([]),
    )
    return () => {
      hidup = false
    }
  }, [app.backend, app.spbuId])
  if (!app.loaded) return <Loading />

  const shiftNama = shiftLabel(stok.key.shift).split(' (')[0]
  const opsHarian = formTampil(app.role, app.settings)
    .filter((g) => g.judul !== 'Pantauan lingkungan')
    .flatMap((g) => g.forms)
    .filter((id) => !['pompa-tangki-rutin', 'outlet-ritel'].includes(id))
  const opsBelum = ops ? opsHarian.filter((id) => statusOps(id, ops.find((r) => r.form === id)) === 'kosong').length : 0
  const items = (menu.find((g) => g.key === 'operation')?.items ?? [])
    // Stok awal tampil sebagai kartu kewajiban di atas, bukan kartu menu.
    .filter((i) => i.path !== '/stok')
    .map((i): ItemMenu =>
      i.path === '/ops'
        ? { ...i, status: !ops ? 'Memuat…' : opsBelum ? `${opsBelum} dari ${opsHarian.length} form belum hari ini` : 'Semua form hari ini terisi', badge: opsBelum }
        : i,
    )

  return (
    <div className="flex flex-col gap-space-md">
      <ArsipFotoBanner className="animate-entrance-1" />
      {app.can('/stok') && stok.tanpaTangki && <TangkiBelumAda className="animate-entrance-1" />}
      {app.can('/stok') && !stok.tanpaTangki && (
        <Link
          to={stok.missing ? `/stok/${stok.key.tanggal}/${stok.key.shift}` : '/stok'}
          className={cn(
            'animate-entrance-1 flex min-h-16 items-center gap-space-sm rounded-lg p-space-sm transition-transform active:scale-[0.99]',
            stok.missing ? 'border border-error/40 bg-error-container/70' : 'glass-1',
          )}
        >
          <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', stok.missing ? 'bg-error text-on-error' : 'bg-primary-fixed text-primary')}>
            {stok.missing ? <Fuel className="size-5" /> : <CircleCheck className="size-5" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn('text-body-md font-bold', stok.missing ? 'text-on-error-container' : 'text-on-surface')}>
              {stok.missing ? `Isi stok awal ${shiftNama}` : `Stok awal ${shiftNama} terisi`}
            </span>
            <span className={cn('text-body-sm', stok.missing ? 'text-on-error-container' : 'text-on-surface-variant')}>
              {stok.missing ? 'Wajib sebelum input bongkaran dan kualitas harian.' : 'Pengeluaran dispenser dihitung dari totalizer.'}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
        </Link>
      )}
      {items.length ? <Grid items={items} label="Menu Operation" /> : <Kosong />}
    </div>
  )
}

/** HSSE & Guard Patrol System > Guard Patrol System: Sampling Penyaluran Subsidi dan Whistleblowing System. */
export function MenuPatrol() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  const items = patrolItems(app.can)
  return (
    <div className="flex flex-col gap-space-md">
      <p className="animate-entrance-1 px-space-xs text-body-md text-on-surface-variant">Pengawasan penyaluran BBM subsidi oleh security dan pelaporan pelanggaran secara rahasia.</p>
      {items.length ? <Grid items={items} label="Menu Guard Patrol System" /> : <Kosong />}
    </div>
  )
}

/** Finance: Petty Cash (pengajuan pengadaan barang/jasa & realisasi anggaran). */
export function MenuFinance() {
  const app = useApp()
  const menu = useMenu()
  if (!app.loaded) return <Loading />
  const items = menu.find((g) => g.key === 'finance')?.items ?? []
  if (!items.length)
    return (
      <GlassCard level={2} className="animate-entrance-1 flex flex-col items-center gap-space-sm p-space-xl text-center">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
          <Wallet className="size-6" strokeWidth={1.6} />
        </span>
        <span className="text-headline-md font-bold text-on-surface">Finance</span>
        <span className="max-w-sm text-body-md text-on-surface-variant">Modul keuangan SPBU untuk ABH, pengawas, dan kepala shift.</span>
      </GlassCard>
    )
  return (
    <div className="flex flex-col gap-space-md">
      <Judul grup="finance" />
      <Grid items={items} label="Menu Finance" />
    </div>
  )
}

/** Report: Riwayat, Export File, dan Berita Acara. */
export function MenuReport() {
  const app = useApp()
  const menu = useMenu()
  if (!app.loaded) return <Loading />
  const items = menu.find((g) => g.key === 'report')?.items ?? []
  const riwayat = riwayatItems(app.can)
  const exp = EXPORT.filter((e) => app.can(e.path))
  return (
    <div className="flex flex-col gap-space-lg">
      <Judul grup="report" />
      {items.length ? <Grid items={items} label="Menu Report" /> : <Kosong />}
      {riwayat.length > 0 && (
        <section aria-labelledby="rp-riwayat" className="flex flex-col gap-space-sm">
          <SectionHeader id="rp-riwayat" title="Riwayat" />
          <Daftar items={riwayat} />
        </section>
      )}
      {exp.length > 0 && (
        <section aria-labelledby="rp-export" className="flex flex-col gap-space-sm">
          <SectionHeader id="rp-export" title="Export File" />
          <Daftar items={exp} />
        </section>
      )}
    </div>
  )
}

function Daftar({ items }: { items: { path: string; icon: ItemMenu['icon']; title: string; desc: string }[] }) {
  return (
    <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
      {items.map((r) => {
        const Icon = r.icon
        return (
          <Link key={r.path} to={r.path} className="flex min-h-16 items-center gap-space-sm px-space-md py-space-sm active:bg-surface-container-low">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-surface-container-low text-on-surface-variant">
              <Icon className="size-5" strokeWidth={1.7} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-md font-semibold text-on-surface">{r.title}</span>
              <span className="text-body-sm text-on-surface-variant">{r.desc}</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
          </Link>
        )
      })}
    </GlassCard>
  )
}

/** Report > Riwayat. */
export function MenuRiwayat() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  const items = riwayatItems(app.can)
  return <div className="flex flex-col gap-space-md">{items.length ? <Daftar items={items} /> : <Kosong />}</div>
}

/** Report > Export File. */
export function MenuExport() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  const items = EXPORT.filter((e) => app.can(e.path))
  return <div className="flex flex-col gap-space-md">{items.length ? <Daftar items={items} /> : <Kosong />}</div>
}

/** Operation > Kaleng Sample (dari hasil pembongkaran). */
export function HalamanKaleng() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  return (
    <div className="animate-entrance-1 flex flex-col gap-space-md">
      <KalengSample />
    </div>
  )
}
